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
    // Try reading header case-insensitively (standard is 'X-Internal-Transaction-Id')
    const internal_txn_id = request.headers.get('X-Internal-Transaction-Id') || request.headers.get('x-internal-transaction-id');
    const ipAddress = request.headers.get('CF-Connecting-IP') || '';
    const upsellData = await request.json() as any; // Consider using a specific type from pixel-router-client
    const { siteId, step, upsellType, offers, shippingId } = upsellData; // Destructure expected body fields
    if (shippingId === undefined) {
        console.error(`[UpsellHandler] Missing shippingId in request payload`);
        return new Response(JSON.stringify({ success: false, message: 'Missing required field: shippingId' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    console.log(`[UpsellHandler] Received request for internal_txn_id: ${internal_txn_id}, siteId: ${siteId}, step: ${step}, type: ${upsellType}`);
    console.log(`[UpsellHandler] DEBUG: Received shippingId from body: ${shippingId}`); // Add log for shippingId

    // --- 2. Basic Validation ---
    const baseMissing = [
        !internal_txn_id && 'X-Internal-Transaction-Id header',
        !siteId && 'siteId',
        !step && 'step',
        !upsellType && 'upsellType',
    ].filter(Boolean);

    const acceptMissing = (upsellType === 'accept') ? [
        !offers && 'offers',
        (shippingId === undefined || shippingId === null) && 'shippingId', // Explicitly check for undefined or null
    ].filter(Boolean) : [];

    const allMissing = [...baseMissing, ...acceptMissing];

    if (allMissing.length > 0) {
        const missingFields = allMissing.join(', ');
        console.error(`[UpsellHandler] Missing required fields: ${missingFields}`);
        return addCorsHeaders(new Response(JSON.stringify({ success: false, message: `Missing required fields: ${missingFields}` }), { status: 400, headers: { 'Content-Type': 'application/json' } }), request);
    }

    // --- 3. Fetch State & Required Config ---
    const stateKey = `txn_${internal_txn_id!}`; // Use the same 'txn_' prefix as other handlers
    console.log(`[UpsellHandler] Attempting to read state from KV with key: ${stateKey}`);

    // Need to read state first to determine scrub status
    const preliminaryStateString = await env.PIXEL_STATE.get(stateKey);
    if (!preliminaryStateString) {
        console.error(`[UpsellHandler] State not found for key: ${stateKey}`);
        return addCorsHeaders(new Response(JSON.stringify({ success: false, message: 'Session not found or expired.' }), { status: 404, headers: { 'Content-Type': 'application/json' } }), request);
    }
    const preliminaryState: PixelState = JSON.parse(preliminaryStateString);

    // Determine which campaign ID key to fetch based on step and scrub status
    const upsellStepNum = parseInt(step);
    if (isNaN(upsellStepNum) || upsellStepNum <= 0) {
        console.error(`[UpsellHandler] Invalid step number format: ${step}`);
        return addCorsHeaders(new Response(JSON.stringify({ success: false, message: `Invalid step number format: ${step}` }), { status: 400, headers: { 'Content-Type': 'application/json' } }), request);
    }

    const isScrub = preliminaryState.scrubDecision?.isScrub ?? false; // Default to false if undefined
    const stateString = preliminaryStateString;
    const state: PixelState = preliminaryState; // Use the parsed state

    // Get campaignId from request payload
    if (!upsellData.campaignId) {
        console.error(`[UpsellHandler] Missing campaignId in request payload`);
        return addCorsHeaders(new Response(JSON.stringify({ success: false, message: 'Missing campaignId in request payload' }), { status: 400, headers: { 'Content-Type': 'application/json' } }), request);
    }
    const targetUpsellCampaignId = upsellData.campaignId;
    console.log(`[UpsellHandler] Using campaignId from request payload: ${targetUpsellCampaignId} (isScrub: ${isScrub})`);

    // State parsing already happened above

    // Access isScrub correctly from state.scrubDecision
    // Use optional chaining for scrubDecision and default to false if undefined
    console.log(`[UpsellHandler] Found state for key ${stateKey}, status: ${state.status}, isScrub: ${isScrub}`);
    console.log(`[UpsellHandler] Using Upsell Campaign ID from config: ${targetUpsellCampaignId} (isScrub: ${isScrub})`);

    // --- 4. Validate State --- // Renumbered step

    // Removed config validation section that was here previously
    // TODO: Update PixelState type in src/types.ts to include stickyOrderId_Initial: string | null
    if (!state.stickyOrderId_Initial) {
        console.error(`[UpsellHandler] Missing state.stickyOrderId_Initial for key: ${stateKey}`); // Log the key
        return addCorsHeaders(new Response(JSON.stringify({ success: false, message: 'Initial order ID missing from session state.' }), { status: 400, headers: { 'Content-Type': 'application/json' } }), request);
    }
    // TODO: Update PixelState type in src/types.ts to include scrubDecision: { isScrub: boolean, targetCampaignId: string }
    // Check for the nested targetCampaignId within scrubDecision
    // Validation for targetCampaignId in state is no longer needed here, as we fetch the specific upsell ID from config
    // if (!state.scrubDecision?.targetCampaignId) { ... } // Removed this check
    // } // <-- This closing brace was incorrect and broke the try block
    // Removed check for config.normal_campaign_id / config.scrub_campaign_id as they don't exist in SiteConfig type and config is not read

    // --- 5. Handle Decline --- // Renumbered step
    if (upsellType === 'decline') {
        console.log(`[UpsellHandler] Upsell declined for step ${step}, key: ${stateKey}. Skipping Sticky.io call.`); // Log the key
        // TODO: Optionally trigger decline-specific actions if needed in the future
        // const declineActionsResult = await triggerUpsellActions(internal_txn_id!, parseInt(step), {}, env, ctx, request, 'decline');
        const responsePayload = {
            success: true,
            message: 'Upsell declined',
            clientActions: [] // declineActionsResult.clientSideActions || []
        };
        return addCorsHeaders(new Response(JSON.stringify(responsePayload), { status: 200, headers: { 'Content-Type': 'application/json' } }), request);
    }
    // --- 6. Construct Sticky.io Upsell Payload (Only for 'accept') --- // Renumbered step

    // targetUpsellCampaignId is now fetched from config above
    // console.log(`[UpsellHandler] Using targetCampaignId from state.scrubDecision: ${targetUpsellCampaignId}`); // Removed redundant log

    // Step number parsing moved earlier

    // upsellStepNum is already parsed above

    // Use 'any' for stickyPayload as the type wasn't found/exported
    const stickyPayload: any = {
      previousOrderId: String(state.stickyOrderId_Initial), // Use from state (assuming type is updated)
      campaignId: String(targetUpsellCampaignId), // Use campaignId fetched from config
      shippingId: String(shippingId), // Use from body
      ipAddress: ipAddress,
      step_num: upsellStepNum, // Use parsed step number
      offers: offers.map((offer: any) => ({ // Use offers from body
        offer_id: offer.offer_id,
        product_id: offer.product_id,
        billing_model_id: offer.billing_model_id,
        quantity: offer.quantity,
        priceRate: offer.priceRate,
        discountPrice: offer.discountPrice,
        regPrice: offer.regPrice,
        shipPrice: offer.shipPrice,
        price: offer.price
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

    // --- 8. Call Sticky.io API using the library function --- // Renumbered step
    // console.log(`[UpsellHandler] Sticky.io Upsell Payload: ${JSON.stringify(payloadToSend)}`); // Avoid logging potentially sensitive data

    const stickyResponse = await callStickyUpsell(payloadToSend, env);

    console.log(`[UpsellHandler] Sticky.io Upsell Response Status for step ${upsellStepNum}: ${stickyResponse._status}`);

    // --- 9. Handle Sticky.io Response --- // Renumbered step
    // console.log(`[UpsellHandler] Sticky.io Upsell Response Body: ${JSON.stringify(stickyResponse)}`); // Avoid logging potentially sensitive data

    if (!stickyResponse._ok || stickyResponse.response_code !== '100') {
      const errorMessage = stickyResponse.error_message || stickyResponse.decline_reason || `Sticky.io Upsell API Error (Code: ${stickyResponse.response_code || stickyResponse._status})`;
      // Log failure with stateKey and previousOrderId from state
      // TODO: Update PixelState type in src/types.ts to include stickyOrderId_Initial
      console.error(`[UpsellHandler] Sticky.io Upsell FAILED for step ${upsellStepNum}, key ${stateKey} (previousOrderId ${state.stickyOrderId_Initial}): ${errorMessage}`, stickyResponse._rawBody); // Log the key
      const status = stickyResponse._status >= 500 ? 502 : 400; // 502 Bad Gateway or 400 Bad Request
      return addCorsHeaders(new Response(JSON.stringify({ success: false, message: errorMessage, details: stickyResponse._rawBody }), { status: status, headers: { 'Content-Type': 'application/json' } }), request);
    }

    // --- 10. Process Success & Trigger Actions --- // Renumbered step

    const newOrderId = stickyResponse.order_id;
    // Use upsellStepNum derived from the 'step' parameter earlier
    // TODO: Update PixelState type in src/types.ts to include stickyOrderId_Initial
    console.log(`[UpsellHandler] Upsell successful for step ${upsellStepNum}, key: ${stateKey} (previousOrderId: ${state.stickyOrderId_Initial}), new orderId: ${newOrderId}`); // Log the key

    // --- Trigger Actions --- // Moved sub-section title

    let clientActions: string[] = []; // Initialize client actions array

    // Validation for upsellStepNum already happened before Sticky call

    // Construct the state update key based on the upsell step
    const upsellStateKey = `stickyOrderId_Upsell${upsellStepNum}` as keyof PixelState;

    // Update the state with the new Order ID asynchronously
    // triggerUpsellActions will handle updating the processed/timestamp flags internally
    ctx.waitUntil(
        env.PIXEL_STATE.get(stateKey).then(currentStateString => { // Read using prefixed key
            if (!currentStateString) {
                console.error(`[UpsellHandler] KV state disappeared before update for key: ${stateKey}`); // Log the key
                return; // Or handle more robustly
            }
            const currentState: PixelState = JSON.parse(currentStateString);
            const finalStateUpdate = {
                ...currentState,
                [upsellStateKey]: newOrderId
            };
            return env.PIXEL_STATE.put(stateKey, JSON.stringify(finalStateUpdate)) // Write using prefixed key
                .then(() => console.log(`[UpsellHandler] Updated KV state for key ${stateKey} with ${upsellStateKey}=${newOrderId}`)) // Log the key
                .catch(err => console.error(`[UpsellHandler] Failed to update KV state for key ${stateKey}`, { error: err })); // Log the key
        })
    );

    // Check payout steps from config (default to 1 if not set)
    // Note: triggerUpsellActions does NOT check payout steps; it fires based on config.
    // The decision to call triggerUpsellActions should be based on whether actions *exist* for that step.
    // We will call it regardless, and it will handle idempotency and finding actions internally.
    console.log(`[UpsellHandler] Triggering actions for step ${upsellStepNum}, key: ${stateKey}.`); // Log the key
    // Correct arguments: internal_txn_id, upsellStepNum, stickyResponse (confirmationData), env, ctx, request
    const actionsResult = await triggerUpsellActions(internal_txn_id!, upsellStepNum, stickyResponse, env, ctx, request); // Pass original ID to actions
    // Use correct property name: clientSideActions
    clientActions = actionsResult.clientSideActions || [];

    // --- 11. Return Success Response --- // Renumbered step


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