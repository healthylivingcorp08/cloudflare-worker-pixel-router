import { Env, PixelState, UpsellRequest, StickyPayload } from '../types';
import { STICKY_URL_MAP } from '../config'; // Added import
import { ExecutionContext } from '@cloudflare/workers-types';
import { callStickyUpsell, callStickyNewOrder } from '../lib/sticky';
import { addCorsHeaders } from '../middleware/cors';
import { triggerUpsellActions } from '../actions';

export async function handleUpsell(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    let internal_txn_id: string | null = null; // Initialize for broader scope in error handling
    try {
        internal_txn_id = request.headers.get('X-Internal-Transaction-Id') || 
                              request.headers.get('x-internal-transaction-id');
        
        if (!internal_txn_id) {
            return addCorsHeaders(new Response(JSON.stringify({ 
                success: false, 
                message: 'Missing internal transaction ID header' 
            }), { status: 400 }), request);
        }
        console.log(`[UpsellHandler] Received X-Internal-Transaction-Id: ${internal_txn_id}`);
        const kvKey = `txn_${internal_txn_id}`;

        const stateString = await env.PIXEL_STATE.get(kvKey);
        if (!stateString) {
            console.error(`[UpsellHandler] Transaction state not found in KV for key: ${kvKey} (internal_txn_id: ${internal_txn_id})`);
            return addCorsHeaders(new Response(JSON.stringify({
                success: false,
                message: 'Transaction state not found'
            }), { status: 404 }), request);
        }

        const state: PixelState = JSON.parse(stateString);
        console.log(`[UpsellHandler] Found PixelState for ${kvKey}:`, { paymentMethod_initial: state.paymentMethod_initial, paypalTransactionId: state.paypalTransactionId, stickyOrderId_initial: state.stickyOrderId_initial, currentStickyOrderId: state.stickyOrderId });

        const upsellData = await request.json() as UpsellRequest;

        // --- Sticky URL ID Handling ---
        // sticky_url_id from UpsellRequest (body) is now optional in types.ts
        // Prioritize header, then body (if frontend sends it), then potentially from state if stored
        const stickyUrlIdFromHeader = request.headers.get('X-Sticky-Url-Id');
        const stickyUrlIdFromBody = upsellData.sticky_url_id; 
        const stickyUrlIdFromState = state.sticky_url_id; // Assuming sticky_url_id might be stored in PixelState

        const stickyUrlId = stickyUrlIdFromHeader || stickyUrlIdFromBody || stickyUrlIdFromState;


        if (!stickyUrlId) {
            console.error(`[UpsellHandler] Missing X-Sticky-Url-Id header or sticky_url_id in payload/state for ${kvKey}`);
            return addCorsHeaders(new Response(JSON.stringify({ success: false, message: 'Missing Sticky URL identifier.' }), { status: 400, headers: { 'Content-Type': 'application/json' } }), request);
        }

        const stickyBaseUrl = STICKY_URL_MAP[stickyUrlId];
        if (!stickyBaseUrl) {
            console.error(`[UpsellHandler] Invalid or missing Sticky Base URL for ID: ${stickyUrlId} (key: ${kvKey})`);
            return addCorsHeaders(new Response(JSON.stringify({ success: false, message: `Invalid Sticky URL identifier: ${stickyUrlId}` }), { status: 400, headers: { 'Content-Type': 'application/json' } }), request);
        }
        console.log(`[UpsellHandler] Using Sticky Base URL: ${stickyBaseUrl} for ID: ${stickyUrlId} (key: ${kvKey})`);
        // --- End Sticky URL ID Handling ---

        const isPaypalFlow = state.paymentMethod_initial === 'paypal' || !!state.paypalTransactionId;
        console.log(`[UpsellHandler] Determined isPaypalFlow: ${isPaypalFlow} for ${kvKey}`);

        if (isPaypalFlow) {
            console.log(`[UpsellHandler] Processing PayPal upsell for ${kvKey}`);
            const paypalUpsellPayload = {
                firstName: state.customerFirstName,
                lastName: state.customerLastName,
                email: state.customerEmail,
                billingAddress1: state.customerAddress?.street,
                billingCity: state.customerAddress?.city,
                billingState: state.customerAddress?.state,
                billingZip: state.customerAddress?.zip,
                billingCountry: state.customerAddress?.country,
                shippingAddress1: state.customerAddress?.street,
                shippingCity: state.customerAddress?.city,
                shippingState: state.customerAddress?.state,
                shippingZip: state.customerAddress?.zip,
                shippingCountry: state.customerAddress?.country,
                
                offers: upsellData.offers,
                shippingId: upsellData.shippingId,
                campaignId: upsellData.campaignId,
                creditCardType: 'paypal',
                alt_pay_return_url: `${upsellData.siteBaseUrl || state.siteBaseUrl}/upsell${upsellData.step + 1}?internal_txn_id=${internal_txn_id}&sticky_url_id=${stickyUrlId}`,
                ipAddress: request.headers.get('CF-Connecting-IP') || '127.0.0.1',
                tranType: "Sale",
            };
            console.log(`[UpsellHandler] PayPal new_order payload for ${kvKey}:`, paypalUpsellPayload);
            const result: StickyPayload = await callStickyNewOrder(stickyBaseUrl, paypalUpsellPayload, env);
            console.log(`[UpsellHandler] PayPal new_order result for ${kvKey}:`, result);

            if (result.gateway_response?.redirect_url) {
                // Path A: PayPal redirect needed
                console.log(`[UpsellHandler] PayPal new_order for upsell requires redirect for ${kvKey}. URL: ${result.gateway_response.redirect_url}`);
                // if (state) { // Consider updating state status here if needed
                //     state.status = 'paypal_upsell_redirect_pending'; // Requires adding to PixelStateStatus type
                //     ctx.waitUntil(env.PIXEL_STATE.put(kvKey, JSON.stringify(state)));
                // }
                return addCorsHeaders(new Response(JSON.stringify({
                    success: true,
                    redirect_url: result.gateway_response.redirect_url,
                    message: "Redirect to PayPal for upsell approval.",
                    orderId: result.order_id,
                    internal_txn_id: internal_txn_id,
                }), { status: 200 }), request);
            
            } else if (result.success === true && result._ok === true && result.order_id) {
                // Path B: PayPal processed directly by Sticky.io
                console.log(`[UpsellHandler] PayPal upsell processed directly by Sticky.io for ${kvKey}. New Order ID: ${result.order_id}`);
                const newUpsellOrderId = result.order_id;
                const updatedState: PixelState = {
                    ...state,
                    stickyOrderId: newUpsellOrderId || state.stickyOrderId,
                    gatewayId: result.gateway_id || state.gatewayId,
                    status: 'paypal_upsell_completed',
                };
                await env.PIXEL_STATE.put(kvKey, JSON.stringify(updatedState));
                console.log(`[UpsellHandler] PIXEL_STATE updated after direct PayPal upsell for ${kvKey}.`);
            
                await triggerUpsellActions(internal_txn_id, upsellData.step, result, env, ctx, request);
                
                return addCorsHeaders(new Response(JSON.stringify({
                    success: true,
                    message: 'PayPal upsell processed directly and successfully.',
                    orderId: newUpsellOrderId,
                    data: result,
                    internal_txn_id: internal_txn_id,
                }), { status: 200 }), request);
            
            } else {
                // Path C: Error or unexpected response
                console.error(`[UpsellHandler] PayPal new_order failed or returned unexpected state for ${kvKey}. Result:`, result);
                const errMsg = result.error_message || result.decline_reason || 'PayPal upsell initiation failed: No redirect URL and no clear order confirmation from payment processor.';
                return addCorsHeaders(new Response(JSON.stringify({
                    success: false,
                    message: errMsg,
                    data: result,
                    internal_txn_id: internal_txn_id,
                }), { status: result._status || 400 }), request);
            }

        } else {
            // Card Upsell Flow
            console.log(`[UpsellHandler] Processing Card upsell for ${kvKey}`);
            // For card upsells, we need the previous order ID (initial or from a prior upsell)
            const previousOrderIdForUpsell = state.stickyOrderId || state.stickyOrderId_initial;
            if (!previousOrderIdForUpsell) {
                console.error(`[UpsellHandler] Missing previous order ID for card upsell. ${kvKey}`);
                return addCorsHeaders(new Response(JSON.stringify({
                    success: false,
                    message: 'Missing previous order ID for card upsell.',
                    internal_txn_id: internal_txn_id,
                }), { status: 400 }), request);
            }

            const cardUpsellPayload = {
                previousOrderId: previousOrderIdForUpsell,
                campaignId: upsellData.campaignId,
                offers: upsellData.offers,
                shippingId: upsellData.shippingId,
                ipAddress: request.headers.get('CF-Connecting-IP') || '127.0.0.1',
                gatewayId: upsellData.forceGatewayId || state.gatewayId,
                preserve_gateway: upsellData.preserve_gateway || "1",
            };
            console.log(`[UpsellHandler] Card new_upsell payload for ${kvKey}:`, cardUpsellPayload);
            const result: StickyPayload = await callStickyUpsell(stickyBaseUrl, cardUpsellPayload, env);
            console.log(`[UpsellHandler] Card new_upsell result for ${kvKey}:`, result);
            
            if (result.success === false || !result._ok || !result.order_id) {
                 console.error(`[UpsellHandler] Card new_upsell failed for ${kvKey}:`, result.error_message || result.decline_reason || 'Unknown error');
                 return addCorsHeaders(new Response(JSON.stringify({
                    success: false,
                    message: result.error_message || result.decline_reason || 'Card upsell placement failed.',
                    data: result,
                    internal_txn_id: internal_txn_id,
                }), { status: result._status || 400 }), request);
            }

            const updatedState: PixelState = {
                ...state,
                status: 'upsell_processed',
                gatewayId: result.gateway_id || state.gatewayId,
            };
            await env.PIXEL_STATE.put(kvKey, JSON.stringify(updatedState));
            console.log(`[UpsellHandler] PIXEL_STATE updated after Card upsell for ${kvKey}. Order ID: ${result.order_id}`);

            await triggerUpsellActions(internal_txn_id, upsellData.step, result, env, ctx, request);

            return addCorsHeaders(new Response(JSON.stringify({
                success: true,
                message: 'Card upsell processed successfully.',
                orderId: result.order_id,
                data: result,
                internal_txn_id: internal_txn_id,
            }), { status: 200 }), request);
        }
    } catch (error: any) {
        // Use kvKey if internal_txn_id is available, otherwise log 'unknown_txn' for the key part
        const kvKeyForError = internal_txn_id ? `txn_${internal_txn_id}` : 'unknown_txn';
        console.error(`[UpsellHandler] Uncaught error for ${kvKeyForError}:`, error.message, error.stack);
        if (internal_txn_id) { // Only try to update state if we have an id
            try {
                // Use kvKeyForError for consistency in error handling KV operations
                const currentStateString = await env.PIXEL_STATE.get(kvKeyForError);
                if (currentStateString) {
                    let currentState: PixelState = JSON.parse(currentStateString);
                    currentState.status = 'error';
                    currentState.lastError = { timestamp: new Date().toISOString(), message: error.message, handler: 'upsell' };
                    ctx.waitUntil(
                        env.PIXEL_STATE.put(kvKeyForError, JSON.stringify(currentState))
                            .catch(kvErr => console.error(`[UpsellHandler] Error handling KV PUT failed for ${kvKeyForError}: ${kvErr.message}`))
                    );
                }
            } catch (kvError) {
                console.error(`[UpsellHandler] Failed to update state to 'error' during error handling for ${kvKeyForError}:`, kvError);
            }
        }
        return addCorsHeaders(new Response(JSON.stringify({
            success: false,
            message: 'Internal server error in upsell handler.',
            internal_txn_id: internal_txn_id, // Return the original id if available
        }), { status: 500 }), request);
    }
}

// Removed the declare module block as UpsellRequest.sticky_url_id is now optional in src/types.ts