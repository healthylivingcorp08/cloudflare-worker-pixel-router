import { Env, PixelState } from '../types'; // Import necessary types
import { ExecutionContext } from '@cloudflare/workers-types';
import { addCorsHeaders } from '../middleware/cors';

/**
 * Handles POST requests to /api/decide-campaign.
 * Determines the target campaign ID based on scrub rules (affiliate, network, global)
 * and stores the initial transaction state in KV.
 */
export async function handleDecideCampaign(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  try {
    console.log('[DecideCampaignHandler] Received request');
    let body: any;
    try {
        body = await request.json();
        console.log('[DecideCampaignHandler] DEBUG: Received body:', JSON.stringify(body)); // Log the received body
    } catch (e) {
        console.error('[DecideCampaignHandler] Failed to parse JSON body:', e);
        return addCorsHeaders(new Response(JSON.stringify({ message: 'Invalid JSON body' }), { status: 400, headers: { 'Content-Type': 'application/json' } }), request);
    }
    // Extract known tracking params, collect others
    // Extract siteId along with other params
    const { siteId, internal_txn_id, affId, c1, sub1, sub2, sub3, uid, click_id, fbc, fbp, utm_source, utm_medium, utm_campaign, utm_content, utm_term, ...otherTrackingParams } = body;

    // Validate required fields
    if (!internal_txn_id || !siteId) {
        const missing = [!internal_txn_id && 'internal_txn_id', !siteId && 'siteId'].filter(Boolean).join(', ');
        return addCorsHeaders(new Response(JSON.stringify({ message: `Missing required fields: ${missing}` }), { status: 400, headers: { 'Content-Type': 'application/json' } }), request);
    }

    // 1. Fetch scrub rules and campaign IDs from PIXEL_CONFIG
    // Use more descriptive keys if possible, matching potential admin UI setup
    // Use siteId prefix for config keys
    const globalScrubKey = `${siteId}_global_scrub_percent`;
    const networkScrubKey = affId ? `${siteId}_network_scrub:${affId}` : null; // Key by network ID (affId)
    const affiliateScrubKey = c1 ? `${siteId}_affiliate_scrub:${c1}` : null; // Key by affiliate ID (c1)
    const normalCampaignIdKey = `${siteId}_normal_campaign_id`;
    const scrubCampaignIdKey = `${siteId}_scrub_campaign_id`;

    console.log(`[DecideCampaignHandler] Fetching KV for site ${siteId}: ${globalScrubKey}, ${networkScrubKey || 'N/A'}, ${affiliateScrubKey || 'N/A'}, ${normalCampaignIdKey}, ${scrubCampaignIdKey}`);

    const [
      globalScrubValue,
      networkScrubValue,
      affiliateScrubValue,
      normalCampaignIdValue,
      scrubCampaignIdValue
    ] = await Promise.all([
      env.PIXEL_CONFIG.get(globalScrubKey),
      networkScrubKey ? env.PIXEL_CONFIG.get(networkScrubKey) : Promise.resolve(null),
      affiliateScrubKey ? env.PIXEL_CONFIG.get(affiliateScrubKey) : Promise.resolve(null),
      env.PIXEL_CONFIG.get(normalCampaignIdKey),
      env.PIXEL_CONFIG.get(scrubCampaignIdKey)
    ]);

    // 2. Determine applicable scrub % (Affiliate > Network > Global)
    let applicableScrubPercent = parseInt(globalScrubValue || '0'); // Default to global
    let scrubSource = 'global';
    if (affiliateScrubValue !== null) {
      applicableScrubPercent = parseInt(affiliateScrubValue);
      scrubSource = `affiliate (${c1})`;
    } else if (networkScrubValue !== null) {
      applicableScrubPercent = parseInt(networkScrubValue);
      scrubSource = `network (${affId})`;
    }
    console.log(`[DecideCampaignHandler] Using ${scrubSource} Scrub %: ${applicableScrubPercent}`);

    // Ensure percentage is within bounds [0, 100]
    applicableScrubPercent = Math.max(0, Math.min(100, applicableScrubPercent || 0));

    // 3. Calculate isScrub
    const isScrub = Math.random() * 100 < applicableScrubPercent;
    console.log(`[DecideCampaignHandler] Scrub Decision: isScrub = ${isScrub} (Threshold: ${applicableScrubPercent}%)`);

    // 4. Determine targetCampaignId
    console.log(`[DecideCampaignHandler] DEBUG: Raw KV value for ${normalCampaignIdKey}:`, normalCampaignIdValue); // Log raw KV value
    console.log(`[DecideCampaignHandler] DEBUG: Raw KV value for ${scrubCampaignIdKey}:`, scrubCampaignIdValue);   // Log raw KV value
    const normalCampaignId = normalCampaignIdValue || 'default_normal_campaign'; // Provide sensible defaults
    const scrubCampaignId = scrubCampaignIdValue || 'default_scrub_campaign';
    const targetCampaignId = isScrub ? scrubCampaignId : normalCampaignId;
    console.log(`[DecideCampaignHandler] Target Campaign ID: ${targetCampaignId}`);

    // 5. Construct initial KV state
    const requestReferer = request.headers.get('Referer'); // Get Referer for initialUrl
    const initialState: PixelState = {
      internal_txn_id: internal_txn_id,
      siteId: siteId, // Add siteId to the state
      initialUrl: requestReferer || undefined, // Store the initial URL
      timestamp_created: new Date().toISOString(),
      timestamp_last_updated: new Date().toISOString(),
      status: 'pending',
      trackingParams: { // Store all relevant tracking params explicitly
        affId,
        c1,
        sub1,
        sub2,
        sub3,
        uid,
        click_id,
        fbc,
        fbp,
        utm_source,
        utm_medium,
        utm_campaign,
        utm_content,
        utm_term,
        ...otherTrackingParams // Include any other params passed
      },
      scrubDecision: {
        isScrub: isScrub,
        targetCampaignId: targetCampaignId
      },
      processed_Initial: false,
      // Initialize other fields
      stickyOrderId_initial: undefined, // Changed from null
      paymentMethod_initial: undefined, // Changed from null
      timestamp_processed_Initial: undefined, // Changed from null
      // Add upsell fields initialized
      stickyOrderId_Upsell1: undefined, // Changed from null
      stickyOrderId_Upsell2: undefined, // Changed from null
      processed_Upsell_1: false,
      processed_Upsell_2: false,
      timestamp_processed_Upsell_1: undefined, // Changed from null
    };

    // 6. Write state to PIXEL_STATE KV with TTL (e.g., 24 hours = 86400 seconds)
    const kvKey = `txn_${internal_txn_id}`;
    // Use ctx.waitUntil to perform the write asynchronously without blocking the response
    ctx.waitUntil(
        env.PIXEL_STATE.put(kvKey, JSON.stringify(initialState), { expirationTtl: 86400 })
            .catch(err => console.error(`[DecideCampaignHandler] Failed to write initial state to KV for ${kvKey}: ${err}`))
    );
    console.log(`[DecideCampaignHandler] Storing initial state to PIXEL_STATE with key: ${kvKey} (async)`);

    // 7. Return targetCampaignId
    const responsePayload = { targetCampaignId: targetCampaignId, campaignId: targetCampaignId, internal_txn_id: internal_txn_id }; // Also return txn_id for frontend use, and campaignId for PayPal
    const response = new Response(JSON.stringify(responsePayload), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });
    return addCorsHeaders(response, request);

  } catch (error: any) {
    console.error('[DecideCampaignHandler] Error:', error);
    const response = new Response(JSON.stringify({ message: `Error deciding campaign: ${error.message}` }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    return addCorsHeaders(response, request);
  }
}