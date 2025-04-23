import { Env, PixelState, SiteConfig } from '../types'; // Removed StickyPayload import
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
    // --- 1. Get Request Data ---
    const internal_txn_id = request.headers.get('X-Internal-Transaction-Id');
    const ipAddress = request.headers.get('CF-Connecting-IP') || '';
    const upsellData = await request.json() as any; // Consider using a specific type from pixel-router-client
    const { siteId, step, upsellType, offers, shippingId } = upsellData; // Destructure expected body fields

    console.log(`[UpsellHandler] Received request for internal_txn_id: ${internal_txn_id}, siteId: ${siteId}, step: ${step}, type: ${upsellType}`);

    // --- 2. Basic Validation ---
    const baseMissing = [
        !internal_txn_id && 'X-Internal-Transaction-Id header',
        !siteId && 'siteId',
        !step && 'step',
        !upsellType && 'upsellType',
    ].filter(Boolean);

    const acceptMissing = (upsellType === 'accept') ? [
        !offers && 'offers',
        !shippingId && 'shippingId',
    ].filter(Boolean) : [];

    const allMissing = [...baseMissing, ...acceptMissing];

    if (allMissing.length > 0) {
        const missingFields = allMissing.join(', ');
        console.error(`[UpsellHandler] Missing required fields: ${missingFields}`);
        return addCorsHeaders(new Response(JSON.stringify({ success: false, message: `Missing required fields: ${missingFields}` }), { status: 400, headers: { 'Content-Type': 'application/json' } }), request);
    }

    // --- 3. Fetch State & Config ---
    const [stateString, configString] = await Promise.all([
        env.PIXEL_STATE.get(internal_txn_id!), // Use non-null assertion as it's validated
        env.PIXEL_CONFIG.get(`site:${siteId}`) // Assuming config is stored per site
    ]);

    if (!stateString) {
        console.error(`[UpsellHandler] State not found for internal_txn_id: ${internal_txn_id!}`);
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
    // Use optional chaining for scrubDecision and default to false if undefined
    console.log(`[UpsellHandler] Found state for ${internal_txn_id!}, status: ${state.status}, isScrub: ${state.scrubDecision?.isScrub ?? 'undefined'}`);

    // --- 4. Validate State & Config ---
    // TODO: Update PixelState type in src/types.ts to include stickyOrderId_Initial: string | null
    if (!state.stickyOrderId_Initial) {
        console.error(`[UpsellHandler] Missing state.stickyOrderId_Initial for internal_txn_id: ${internal_txn_id!}`);
        return addCorsHeaders(new Response(JSON.stringify({ success: false, message: 'Initial order ID missing from session state.' }), { status: 400, headers: { 'Content-Type': 'application/json' } }), request);
    }
    // TODO: Update PixelState type in src/types.ts to include targetCampaignId: string | null (set during checkout)
    if (!state.targetCampaignId) {
         console.error(`[UpsellHandler] Missing state.targetCampaignId for internal_txn_id: ${internal_txn_id!}`);
        return addCorsHeaders(new Response(JSON.stringify({ success: false, message: 'Target campaign ID missing from session state.' }), { status: 400, headers: { 'Content-Type': 'application/json' } }), request);
    }
    // Removed check for config.normal_campaign_id / config.scrub_campaign_id as they don't exist in SiteConfig type

    // --- 5. Handle Decline ---
    if (upsellType === 'decline') {
        console.log(`[UpsellHandler] Upsell declined for step ${step}, internal_txn_id: ${internal_txn_id!}. Skipping Sticky.io call.`);
        // TODO: Optionally trigger decline-specific actions if needed in the future
        // const declineActionsResult = await triggerUpsellActions(internal_txn_id!, parseInt(step), {}, env, ctx, request, 'decline');
        const responsePayload = {
            success: true,
            message: 'Upsell declined',
            clientActions: [] // declineActionsResult.clientSideActions || []
        };
        return addCorsHeaders(new Response(JSON.stringify(responsePayload), { status: 200, headers: { 'Content-Type': 'application/json' } }), request);
    }

    // --- 6. Get Target Campaign ID (Only for 'accept') ---
    // Use the targetCampaignId stored in the state from the initial checkout/scrub decision
    // TODO: Ensure state.targetCampaignId is correctly set in checkout handler and added to PixelState type
    const targetUpsellCampaignId = state.targetCampaignId;
    console.log(`[UpsellHandler] Using targetCampaignId from state: ${targetUpsellCampaignId}`);

    // --- 7. Construct Sticky.io Upsell Payload (Only for 'accept') ---
    const upsellStepNum = parseInt(step); // Convert step string to number for Sticky
    if (isNaN(upsellStepNum) || upsellStepNum <= 0) {
        console.error(`[UpsellHandler] Invalid step number format: ${step}`);
        return addCorsHeaders(new Response(JSON.stringify({ success: false, message: `Invalid step number format: ${step}` }), { status: 400, headers: { 'Content-Type': 'application/json' } }), request);
    }

    // Use 'any' for stickyPayload as the type wasn't found/exported
    const stickyPayload: any = {
      previousOrderId: String(state.stickyOrderId_Initial), // Use from state (assuming type is updated)
      campaignId: String(targetUpsellCampaignId), // Use campaignId from state
      shippingId: String(shippingId), // Use from body
      ipAddress: ipAddress,
      step_num: upsellStepNum, // Use parsed step number
      offers: offers.map((offer: any) => ({ // Use offers from body
        offer_id: offer.offer_id,
        product_id: offer.product_id,
        billing_model_id: offer.billing_model_id,
        quantity: offer.quantity,
        // Remove step_num from here
      })),
      // Remove ...trackingParams
    };

    // Remove undefined fields (optional, callStickyApi might handle this)
    const payloadToSend = stickyPayload as Record<string, any>;
    Object.keys(payloadToSend).forEach(key => payloadToSend[key] === undefined && delete payloadToSend[key]);
    if (payloadToSend.offers && Array.isArray(payloadToSend.offers)) {
        payloadToSend.offers.forEach((offer: Record<string, any>) => {
            Object.keys(offer).forEach(key => offer[key] === undefined && delete offer[key]);
        });
    }


    console.log(`[UpsellHandler] Calling Sticky.io Upsell for step ${upsellStepNum}`);
    // console.log(`[UpsellHandler] Sticky.io Upsell Payload: ${JSON.stringify(payloadToSend)}`); // Avoid logging potentially sensitive data

    // --- 8. Call Sticky.io API using the library function ---
    const stickyResponse = await callStickyUpsell(payloadToSend, env);

    console.log(`[UpsellHandler] Sticky.io Upsell Response Status for step ${upsellStepNum}: ${stickyResponse._status}`);
    // console.log(`[UpsellHandler] Sticky.io Upsell Response Body: ${JSON.stringify(stickyResponse)}`); // Avoid logging potentially sensitive data

    // --- 9. Handle Sticky.io Response ---
    if (!stickyResponse._ok || stickyResponse.response_code !== '100') {
      const errorMessage = stickyResponse.error_message || stickyResponse.decline_reason || `Sticky.io Upsell API Error (Code: ${stickyResponse.response_code || stickyResponse._status})`;
      // Log failure with internal_txn_id and previousOrderId from state
      // TODO: Update PixelState type in src/types.ts to include stickyOrderId_Initial
      console.error(`[UpsellHandler] Sticky.io Upsell FAILED for step ${upsellStepNum}, internal_txn_id ${internal_txn_id!} (previousOrderId ${state.stickyOrderId_Initial}): ${errorMessage}`, stickyResponse._rawBody);
      const status = stickyResponse._status >= 500 ? 502 : 400; // 502 Bad Gateway or 400 Bad Request
      return addCorsHeaders(new Response(JSON.stringify({ success: false, message: errorMessage, details: stickyResponse._rawBody }), { status: status, headers: { 'Content-Type': 'application/json' } }), request);
    }

    // --- SUCCESS ---
    const newOrderId = stickyResponse.order_id;
    // Use upsellStepNum derived from the 'step' parameter earlier
    // TODO: Update PixelState type in src/types.ts to include stickyOrderId_Initial
    console.log(`[UpsellHandler] Upsell successful for step ${upsellStepNum}, internal_txn_id: ${internal_txn_id!} (previousOrderId: ${state.stickyOrderId_Initial}), new orderId: ${newOrderId}`);

    // --- 10. Trigger Actions ---
    let clientActions: string[] = []; // Initialize client actions array

    // Validation for upsellStepNum already happened before Sticky call

    // Construct the state update key based on the upsell step
    const upsellStateKey = `stickyOrderId_Upsell${upsellStepNum}` as keyof PixelState;

    // Update the state with the new Order ID asynchronously
    // triggerUpsellActions will handle updating the processed/timestamp flags internally
    ctx.waitUntil(
        env.PIXEL_STATE.get(internal_txn_id!).then(currentStateString => {
            if (!currentStateString) {
                console.error(`[UpsellHandler] KV state disappeared before update for ${internal_txn_id!}`);
                return; // Or handle more robustly
            }
            const currentState: PixelState = JSON.parse(currentStateString);
            const finalStateUpdate = {
                ...currentState,
                [upsellStateKey]: newOrderId
            };
            return env.PIXEL_STATE.put(internal_txn_id!, JSON.stringify(finalStateUpdate))
                .then(() => console.log(`[UpsellHandler] Updated KV state for ${internal_txn_id!} with ${upsellStateKey}=${newOrderId}`))
                .catch(err => console.error(`[UpsellHandler] Failed to update KV state for ${internal_txn_id!}`, { error: err }));
        })
    );

    // Check payout steps from config (default to 1 if not set)
    // Note: triggerUpsellActions does NOT check payout steps; it fires based on config.
    // The decision to call triggerUpsellActions should be based on whether actions *exist* for that step.
    // We will call it regardless, and it will handle idempotency and finding actions internally.
    console.log(`[UpsellHandler] Triggering actions for step ${upsellStepNum}.`);
    // Correct arguments: internal_txn_id, upsellStepNum, stickyResponse (confirmationData), env, ctx, request
    const actionsResult = await triggerUpsellActions(internal_txn_id!, upsellStepNum, stickyResponse, env, ctx, request);
    // Use correct property name: clientSideActions
    clientActions = actionsResult.clientSideActions || [];


    // --- 11. Return Success Response ---
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