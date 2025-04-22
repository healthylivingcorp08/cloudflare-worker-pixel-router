import { Env, StickyPayload, PixelState, SiteConfig } from '../types'; // Changed PixelConfig to SiteConfig
import { ExecutionContext } from '@cloudflare/workers-types';
import { addCorsHeaders } from '../middleware/cors';
import { callStickyUpsell } from '../lib/sticky';
import { triggerUpsellActions } from '../actions'; // Added triggerUpsellActions

/**
 * Handles POST requests to /api/upsell.
 * Processes upsell data, calls Sticky.io, and potentially triggers actions.
 */
export async function handleUpsell(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  try {
    const upsellData = await request.json() as any;
    // Destructure expected fields, including internal_txn_id
    const { internal_txn_id, siteId, offers, shippingId, ...trackingParams } = upsellData; // Removed previousOrderId, campaignId
    const ipAddress = request.headers.get('CF-Connecting-IP') || '';

    console.log(`[UpsellHandler] Received request for internal_txn_id: ${internal_txn_id}, siteId: ${siteId}`);

    // --- 1. Basic Validation ---
    if (!internal_txn_id || !siteId || !offers || !shippingId) {
      const missing = [
        !internal_txn_id && 'internal_txn_id',
        !siteId && 'siteId',
        !offers && 'offers',
        !shippingId && 'shippingId',
      ].filter(Boolean).join(', ');
      console.error(`[UpsellHandler] Missing required fields: ${missing}`);
      return addCorsHeaders(new Response(JSON.stringify({ success: false, message: `Missing required fields: ${missing}` }), { status: 400, headers: { 'Content-Type': 'application/json' } }), request);
    }

    // --- 2. Fetch State & Config ---
    const [stateString, configString] = await Promise.all([
        env.PIXEL_STATE.get(internal_txn_id),
        env.PIXEL_CONFIG.get(`site:${siteId}`) // Assuming config is stored per site
    ]);

    if (!stateString) {
        console.error(`[UpsellHandler] State not found for internal_txn_id: ${internal_txn_id}`);
        return addCorsHeaders(new Response(JSON.stringify({ success: false, message: 'Session not found or expired.' }), { status: 404, headers: { 'Content-Type': 'application/json' } }), request);
    }
    if (!configString) {
        console.error(`[UpsellHandler] Config not found for siteId: ${siteId}`);
        // Config missing is a server error
        return addCorsHeaders(new Response(JSON.stringify({ success: false, message: 'Site configuration not found.' }), { status: 500, headers: { 'Content-Type': 'application/json' } }), request);
    }

    const state: PixelState = JSON.parse(stateString);
    const config: SiteConfig = JSON.parse(configString); // Use SiteConfig type

    // Access isScrub correctly from state.scrubDecision
    console.log(`[UpsellHandler] Found state for ${internal_txn_id}, status: ${state.status}, isScrub: ${state.scrubDecision.isScrub}`);

    // --- 3. Validate State & Config ---
    if (!state.stickyOrderId_Initial) {
        console.error(`[UpsellHandler] Missing stickyOrderId_Initial in state for internal_txn_id: ${internal_txn_id}`);
        return addCorsHeaders(new Response(JSON.stringify({ success: false, message: 'Initial order ID missing from session.' }), { status: 400, headers: { 'Content-Type': 'application/json' } }), request);
    }
    if (!config.normal_campaign_id || !config.scrub_campaign_id) {
        console.error(`[UpsellHandler] Missing campaign IDs in config for siteId: ${siteId}`);
        return addCorsHeaders(new Response(JSON.stringify({ success: false, message: 'Site campaign configuration incomplete.' }), { status: 500, headers: { 'Content-Type': 'application/json' } }), request);
    }

    // --- 4. Determine Target Campaign ID ---
    // Access isScrub correctly from state.scrubDecision
    const targetUpsellCampaignId = state.scrubDecision.isScrub ? config.scrub_campaign_id : config.normal_campaign_id;
    console.log(`[UpsellHandler] Determined targetUpsellCampaignId: ${targetUpsellCampaignId} (isScrub: ${state.scrubDecision.isScrub})`);

    // --- 5. Construct Sticky.io Upsell Payload ---
    const stickyPayload: StickyPayload = {
      previousOrderId: String(state.stickyOrderId_Initial), // Use from state
      campaignId: String(targetUpsellCampaignId), // Use determined campaign ID
      shippingId: String(shippingId),
      ipAddress: ipAddress,
      offers: offers.map((offer: any) => ({
        offer_id: offer.offer_id,
        product_id: offer.product_id,
        billing_model_id: offer.billing_model_id,
        quantity: offer.quantity,
        step_num: offer.step_num
      })),
      ...trackingParams // Pass through other tracking params
    };

    // Remove undefined fields (optional, callStickyApi might handle this)
    const payloadToSend = stickyPayload as Record<string, any>;
    Object.keys(payloadToSend).forEach(key => payloadToSend[key] === undefined && delete payloadToSend[key]);
    if (payloadToSend.offers && Array.isArray(payloadToSend.offers)) {
        payloadToSend.offers.forEach((offer: Record<string, any>) => {
            Object.keys(offer).forEach(key => offer[key] === undefined && delete offer[key]);
        });
    }


    console.log(`[UpsellHandler] Calling Sticky.io Upsell`);
    // console.log(`[UpsellHandler] Sticky.io Upsell Payload: ${JSON.stringify(payloadToSend)}`); // Avoid logging potentially sensitive data

    // --- 6. Call Sticky.io API using the library function ---
    const stickyResponse = await callStickyUpsell(payloadToSend, env);

    console.log(`[UpsellHandler] Sticky.io Upsell Response Status: ${stickyResponse._status}`);
    // console.log(`[UpsellHandler] Sticky.io Upsell Response Body: ${JSON.stringify(stickyResponse)}`); // Avoid logging potentially sensitive data

    // --- 7. Handle Sticky.io Response ---
    if (!stickyResponse._ok || stickyResponse.response_code !== '100') {
      const errorMessage = stickyResponse.error_message || stickyResponse.decline_reason || `Sticky.io Upsell API Error (Code: ${stickyResponse.response_code || stickyResponse._status})`;
      // Log failure with internal_txn_id and previousOrderId from state
      console.error(`[UpsellHandler] Sticky.io Upsell FAILED for internal_txn_id ${internal_txn_id} (previousOrderId ${state.stickyOrderId_Initial}): ${errorMessage}`, stickyResponse._rawBody);
      const status = stickyResponse._status >= 500 ? 502 : 400; // 502 Bad Gateway or 400 Bad Request
      return addCorsHeaders(new Response(JSON.stringify({ success: false, message: errorMessage, details: stickyResponse._rawBody }), { status: status, headers: { 'Content-Type': 'application/json' } }), request);
    }

    // --- SUCCESS ---
    const newOrderId = stickyResponse.order_id;
    const upsellStep = offers[0]?.step_num;
    console.log(`[UpsellHandler] Upsell successful for internal_txn_id: ${internal_txn_id} (previousOrderId: ${state.stickyOrderId_Initial}), new orderId: ${newOrderId}, step: ${upsellStep}`);

    // --- 8. Validate Upsell Step & Trigger Actions ---
    let clientActions: string[] = []; // Initialize client actions array (corrected type)

    // Validate upsellStep
    if (typeof upsellStep !== 'number' || upsellStep <= 0) {
        console.error(`[UpsellHandler] Invalid or missing upsell step number: ${upsellStep} for internal_txn_id: ${internal_txn_id}`);
        // Return success but indicate the step issue, as the Sticky.io call succeeded
        return addCorsHeaders(new Response(JSON.stringify({ success: true, orderId: newOrderId, message: `Upsell successful but invalid step number (${upsellStep}) provided. Actions skipped.`, clientActions: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } }), request);
    }

    // Construct the state update key based on the upsell step
    const upsellStateKey = `stickyOrderId_Upsell${upsellStep}` as keyof PixelState;

    // Update the state with the new Order ID asynchronously
    // triggerUpsellActions will handle updating the processed/timestamp flags internally
    ctx.waitUntil(
        env.PIXEL_STATE.get(internal_txn_id).then(currentStateString => {
            if (!currentStateString) {
                console.error(`[UpsellHandler] KV state disappeared before update for ${internal_txn_id}`);
                return; // Or handle more robustly
            }
            const currentState: PixelState = JSON.parse(currentStateString);
            const finalStateUpdate = {
                ...currentState,
                [upsellStateKey]: newOrderId
            };
            return env.PIXEL_STATE.put(internal_txn_id, JSON.stringify(finalStateUpdate))
                .then(() => console.log(`[UpsellHandler] Updated KV state for ${internal_txn_id} with ${upsellStateKey}=${newOrderId}`))
                .catch(err => console.error(`[UpsellHandler] Failed to update KV state for ${internal_txn_id}`, { error: err }));
        })
    );

    // Check payout steps from config (default to 1 if not set)
    // Note: triggerUpsellActions does NOT check payout steps; it fires based on config.
    // The decision to call triggerUpsellActions should be based on whether actions *exist* for that step.
    // We will call it regardless, and it will handle idempotency and finding actions internally.
    console.log(`[UpsellHandler] Triggering actions for step ${upsellStep}.`);
    // Correct arguments: internal_txn_id, upsellStep, stickyResponse (confirmationData), env, ctx, request
    const actionsResult = await triggerUpsellActions(internal_txn_id, upsellStep, stickyResponse, env, ctx, request);
    // Use correct property name: clientSideActions
    clientActions = actionsResult.clientSideActions || [];


    // --- 9. Return Success Response ---
    const responsePayload = {
      success: true,
      orderId: newOrderId,
      message: 'Upsell processed successfully',
      clientActions: clientActions // Include client actions
    };
    const response = new Response(JSON.stringify(responsePayload), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });
    return addCorsHeaders(response, request);

  } catch (error: any) {
    console.error('[UpsellHandler] Error processing upsell:', error);
    const response = new Response(JSON.stringify({ success: false, message: `Error processing upsell: ${error.message}` }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    return addCorsHeaders(response, request);
  }
}