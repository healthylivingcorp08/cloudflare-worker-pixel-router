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
    const body = await request.json() as any; // Use 'any' for flexibility
    // Extract known tracking params, collect others
    const { internal_txn_id, affId, c1, sub1, sub2, sub3, uid, click_id, fbc, fbp, utm_source, utm_medium, utm_campaign, utm_content, utm_term, ...otherTrackingParams } = body;

    if (!internal_txn_id) {
      return addCorsHeaders(new Response(JSON.stringify({ message: 'Missing internal_txn_id' }), { status: 400, headers: { 'Content-Type': 'application/json' } }), request);
    }

    // 1. Fetch scrub rules and campaign IDs from PIXEL_CONFIG
    // Use more descriptive keys if possible, matching potential admin UI setup
    const globalScrubKey = 'config_global_scrub_percent';
    const networkScrubKey = `config_network_scrub:${affId}`; // Key by network ID (affId)
    const affiliateScrubKey = `config_affiliate_scrub:${c1}`; // Key by affiliate ID (c1)
    const normalCampaignIdKey = 'config_normal_campaign_id';
    const scrubCampaignIdKey = 'config_scrub_campaign_id';

    console.log(`[DecideCampaignHandler] Fetching KV: ${globalScrubKey}, ${networkScrubKey}, ${affiliateScrubKey}, ${normalCampaignIdKey}, ${scrubCampaignIdKey}`);

    const [
      globalScrubValue,
      networkScrubValue,
      affiliateScrubValue,
      normalCampaignIdValue,
      scrubCampaignIdValue
    ] = await Promise.all([
      env.PIXEL_CONFIG.get(globalScrubKey),
      affId ? env.PIXEL_CONFIG.get(networkScrubKey) : Promise.resolve(null),
      c1 ? env.PIXEL_CONFIG.get(affiliateScrubKey) : Promise.resolve(null),
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
    const normalCampaignId = normalCampaignIdValue || 'default_normal_campaign'; // Provide sensible defaults
    const scrubCampaignId = scrubCampaignIdValue || 'default_scrub_campaign';
    const targetCampaignId = isScrub ? scrubCampaignId : normalCampaignId;
    console.log(`[DecideCampaignHandler] Target Campaign ID: ${targetCampaignId}`);

    // 5. Construct initial KV state
    const initialState: PixelState = {
      internal_txn_id: internal_txn_id,
      timestamp_created: new Date().toISOString(),
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
      stickyOrderId_Initial: null,
      paymentMethod_Initial: null,
      timestamp_processed_Initial: null,
      // Add upsell fields initialized
      stickyOrderId_Upsell1: null,
      stickyOrderId_Upsell2: null,
      processed_Upsell_1: false,
      processed_Upsell_2: false,
      timestamp_processed_Upsell_1: null,
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
    const responsePayload = { targetCampaignId: targetCampaignId, internal_txn_id: internal_txn_id }; // Also return txn_id for frontend use
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