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
            }), { status: 400, headers: { 'Content-Type': 'application/json;charset=UTF-8' } }), request);
        }
        console.log(`[UpsellHandler] Received X-Internal-Transaction-Id: ${internal_txn_id}`);
        const kvKey = `txn_${internal_txn_id}`;

        const stateString = await env.PIXEL_STATE.get(kvKey);
        if (!stateString) {
            console.error(`[UpsellHandler] Transaction state not found in KV for key: ${kvKey} (internal_txn_id: ${internal_txn_id})`);
            return addCorsHeaders(new Response(JSON.stringify({
                success: false,
                message: 'Transaction state not found'
            }), { status: 404, headers: { 'Content-Type': 'application/json;charset=UTF-8' } }), request);
        }

        const state: PixelState = JSON.parse(stateString);
        console.log(`[UpsellHandler] Found PixelState for ${kvKey}:`, { paymentMethod_initial: state.paymentMethod_initial, paypalTransactionId: state.paypalTransactionId, paypalPayerId: state.paypalPayerId, stickyOrderId_initial: state.stickyOrderId_initial, currentStickyOrderId: state.stickyOrderId, customerFirstName: state.customerFirstName });

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
            return addCorsHeaders(new Response(JSON.stringify({ success: false, message: 'Missing Sticky URL identifier.' }), { status: 400, headers: { 'Content-Type': 'application/json;charset=UTF-8' } }), request);
        }

        const stickyBaseUrl = STICKY_URL_MAP[stickyUrlId];
        if (!stickyBaseUrl) {
            console.error(`[UpsellHandler] Invalid or missing Sticky Base URL for ID: ${stickyUrlId} (key: ${kvKey})`);
            return addCorsHeaders(new Response(JSON.stringify({ success: false, message: `Invalid Sticky URL identifier: ${stickyUrlId}` }), { status: 400, headers: { 'Content-Type': 'application/json;charset=UTF-8' } }), request);
        }
        console.log(`[UpsellHandler] Using Sticky Base URL: ${stickyBaseUrl} for ID: ${stickyUrlId} (key: ${kvKey})`);
        // --- End Sticky URL ID Handling ---

        const isPaypalFlow = state.paymentMethod_initial === 'paypal' || !!state.paypalTransactionId;
        console.log(`[UpsellHandler] Determined isPaypalFlow: ${isPaypalFlow} for ${kvKey}`);

        if (isPaypalFlow) {
            console.log(`[UpsellHandler] Processing PayPal upsell for ${kvKey}`);
            if (!state.stickyOrderId_initial) {
                console.error(`[UpsellHandler] Missing stickyOrderId_initial for PayPal upsell. ${kvKey}`);
                return addCorsHeaders(new Response(JSON.stringify({ success: false, message: 'Missing initial order ID for PayPal upsell.' }), { status: 400, headers: { 'Content-Type': 'application/json;charset=UTF-8' } }), request);
            }
            if (!state.paypalTransactionId) { // This is the EC token
                console.error(`[UpsellHandler] Missing paypalTransactionId (EC Token) for PayPal upsell. ${kvKey}`);
                return addCorsHeaders(new Response(JSON.stringify({ success: false, message: 'Missing PayPal token for upsell.' }), { status: 400, headers: { 'Content-Type': 'application/json;charset=UTF-8' } }), request);
            }
            // Removed critical error for missing paypalPayerId.
            // It will be conditionally added to the payload.
            // If Sticky.io requires it, their API will return an error.
            if (!state.paypalPayerId) {
                console.warn(`[UpsellHandler] paypalPayerId is missing for PayPal upsell. Proceeding without it. ${kvKey}`);
            }

            let previousPaypalOrderId: string | undefined | null;
            if (upsellData.step === 1) {
                previousPaypalOrderId = state.stickyOrderId_initial;
            } else if (upsellData.step === 2) {
                previousPaypalOrderId = state.stickyOrderId_initial;
            } else if (upsellData.step === 3) {
                previousPaypalOrderId = state.stickyOrderId_initial;
            } else {
                // Should not happen if steps are 1, 2, or 3
                console.error(`[UpsellHandler] Invalid upsell step (${upsellData.step}) for determining PayPal previousOrderId for ${kvKey}`);
                return addCorsHeaders(new Response(JSON.stringify({ success: false, message: 'Invalid upsell step.' }), { status: 400, headers: { 'Content-Type': 'application/json;charset=UTF-8' } }), request);
            }

            if (!previousPaypalOrderId) {
                console.error(`[UpsellHandler] Missing previous order ID for PayPal upsell step ${upsellData.step}. Required ID (e.g., stickyOrderId_Upsell${upsellData.step -1}) not found in state for ${kvKey}.`);
                return addCorsHeaders(new Response(JSON.stringify({ success: false, message: `Missing previous order ID context for upsell step ${upsellData.step}.` }), { status: 400, headers: { 'Content-Type': 'application/json;charset=UTF-8' } }), request);
            }
 
            const paypalUpsellPayload: any = {
                previousOrderId: previousPaypalOrderId,
                campaignId: upsellData.campaignId,
                offers: upsellData.offers,
                shippingId: upsellData.shippingId,
                ipAddress: request.headers.get('CF-Connecting-IP') || '127.0.0.1',
                
                // PayPal specific fields for new_upsell
                creditCardType: 'paypal',
                paypal_token: state.paypalTransactionId, // EC Token
                // Conditionally add paypal_payer_id only if it exists
                ...(state.paypalPayerId && { paypal_payer_id: state.paypalPayerId }),
                gatewayId: state.gatewayId, // Gateway ID from the initial transaction

                // Customer details from state (populated by paypalReturn.ts)
                firstName: state.customerFirstName,
                lastName: state.customerLastName,
                email: state.customerEmail,
                phone: state.customerPhone,
                billingAddress1: state.customerAddress?.street,
                billingAddress2: state.customerAddress?.street2,
                billingCity: state.customerAddress?.city,
                billingState: state.customerAddress?.state,
                billingZip: state.customerAddress?.zip,
                billingCountry: state.customerAddress?.country,
                
                // Shipping details from state (populated by paypalReturn.ts)
                // Sticky.io might infer shipping from previousOrderId, but providing it is safer.
                // Use the main customer name from state, assuming shipping name is same as billing.
                shippingFirstName: state.customerFirstName,
                shippingLastName: state.customerLastName,
                shippingAddress1: state.customerShippingAddress?.street,
                shippingAddress2: state.customerShippingAddress?.street2,
                shippingCity: state.customerShippingAddress?.city,
                shippingState: state.customerShippingAddress?.state,
                shippingZip: state.customerShippingAddress?.zip,
                shippingCountry: state.customerShippingAddress?.country,

                // Optional fields from user's sample new_upsell request, if needed
                // notes: "PayPal upsell via server_cloudflare_tech",
                // AFID: state.affid, // If you store these in state
                website: state.initialUrl ? `${state.initialUrl}` : (state.siteBaseUrl ? `${state.siteBaseUrl}` : `PayPal Upsell (source URL not available)`),
            };
            
            // Remove undefined fields from payload to keep it clean
            Object.keys(paypalUpsellPayload).forEach(key => paypalUpsellPayload[key] === undefined && delete paypalUpsellPayload[key]);

            console.log(`[UpsellHandler] PayPal new_upsell payload for ${kvKey}:`, JSON.stringify(paypalUpsellPayload));
            // Using callStickyUpsell for PayPal flow now
            const result: StickyPayload = await callStickyUpsell(stickyBaseUrl, paypalUpsellPayload, env, paypalUpsellPayload.gatewayId);
            console.log(`[UpsellHandler] PayPal new_upsell result for ${kvKey}:`, JSON.stringify(result));

            // For new_upsell with PayPal token, we expect a direct success or failure, not a redirect.
            if (result && result.response_code === "100" && result.order_id) {
                console.log(`[UpsellHandler] PayPal upsell processed successfully by Sticky.io for ${kvKey}. New Order ID: ${result.order_id}`);
                const newUpsellOrderId = result.order_id;
                const updatedState: PixelState = {
                    ...state,
                    // Update stickyOrderId to the new upsell order ID
                    stickyOrderId: newUpsellOrderId,
                    // gatewayId might be confirmed or changed by the upsell response
                    gatewayId: result.gateway_id || state.gatewayId,
                    status: 'paypal_upsell_completed', // Custom status
                };
                // Store the upsell order ID based on step
                if (upsellData.step === 1) {
                    updatedState.stickyOrderId_Upsell1 = newUpsellOrderId;
                    // processed_Upsell_1 will be set by triggerUpsellActions
                    updatedState.timestamp_processed_Upsell_1 = new Date().toISOString();
                } else if (upsellData.step === 2) {
                    updatedState.stickyOrderId_Upsell2 = newUpsellOrderId;
                    // processed_Upsell_2 will be set by triggerUpsellActions
                    updatedState.timestamp_processed_Upsell_2 = new Date().toISOString();
                } else if (upsellData.step === 3) { // Added step 3 handling
                    updatedState.stickyOrderId_Upsell3 = newUpsellOrderId;
                    // processed_Upsell_3 will be set by triggerUpsellActions
                    updatedState.timestamp_processed_Upsell_3 = new Date().toISOString();
                }
                // Add more steps if necessary, ensuring PixelState in types.ts supports them or uses [key:string]:any

                await env.PIXEL_STATE.put(kvKey, JSON.stringify(updatedState));
                console.log(`[UpsellHandler] PIXEL_STATE updated after PayPal new_upsell for ${kvKey}.`);
            
                await triggerUpsellActions(internal_txn_id, upsellData.step, result, env, ctx, request);

                let nextPagePath = '';
                if (upsellData.step === 1) {
                    nextPagePath = '/upsell2';
                } else if (upsellData.step === 2) {
                    nextPagePath = '/upsell3';
                } else if (upsellData.step === 3) {
                    nextPagePath = '/thank-you'; // Default thank you page path
                }

                const nextPageUrl = nextPagePath && state.siteBaseUrl ? new URL(nextPagePath, state.siteBaseUrl).href : undefined;
                
                return addCorsHeaders(new Response(JSON.stringify({
                    success: true,
                    message: 'PayPal upsell processed successfully.',
                    orderId: newUpsellOrderId,
                    data: result,
                    internal_txn_id: internal_txn_id,
                    next_page_url: nextPageUrl,
                }), { status: 200, headers: { 'Content-Type': 'application/json;charset=UTF-8' } }), request);
            
            } else {
                // Error or unexpected response from new_upsell
                console.error(`[UpsellHandler] PayPal new_upsell failed or returned unexpected state for ${kvKey}. Result:`, result);
                const errMsg = result.error_message || result.decline_reason || 'PayPal upsell failed.';
                // Update state to reflect error
                state.status = 'failed'; // Or a more specific 'paypal_upsell_failed'
                state.lastError = { timestamp: new Date().toISOString(), message: errMsg, handler: 'upsell (paypal)'};
                ctx.waitUntil(env.PIXEL_STATE.put(kvKey, JSON.stringify(state)));

                return addCorsHeaders(new Response(JSON.stringify({
                    success: false,
                    message: errMsg,
                    data: result,
                    internal_txn_id: internal_txn_id,
                }), { status: result._status || 400, headers: { 'Content-Type': 'application/json;charset=UTF-8' } }), request);
            }

        } else {
            // Card Upsell Flow
            console.log(`[UpsellHandler] Processing Card upsell for ${kvKey}`);
            // For card upsells, we need the previous order ID (initial or from a prior upsell)
            const previousOrderIdForUpsell = state.stickyOrderId_initial ||  state.stickyOrderId;
            if (!previousOrderIdForUpsell) {
                console.error(`[UpsellHandler] Missing previous order ID for card upsell. ${kvKey}`);
                return addCorsHeaders(new Response(JSON.stringify({
                    success: false,
                    message: 'Missing previous order ID for card upsell.',
                    internal_txn_id: internal_txn_id,
                }), { status: 400, headers: { 'Content-Type': 'application/json;charset=UTF-8' } }), request);
            }

            const cardUpsellPayload = {
                previousOrderId: previousOrderIdForUpsell,
                campaignId: upsellData.campaignId,
                offers: upsellData.offers,
                shippingId: upsellData.shippingId,
                ipAddress: request.headers.get('CF-Connecting-IP') || '127.0.0.1',
                gatewayId: upsellData.forceGatewayId || state.gatewayId,
                preserve_gateway: upsellData.preserve_gateway || "1",
website: state.initialUrl ? `Card Upsell on ${state.initialUrl}` : (state.siteBaseUrl ? `Card Upsell on ${state.siteBaseUrl}` : `Card Upsell (source URL not available)`),
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
                }), { status: result._status || 400, headers: { 'Content-Type': 'application/json;charset=UTF-8' } }), request);
            }

            const updatedState: PixelState = {
                ...state,
                status: 'upsell_processed', // General status
                stickyOrderId: result.order_id, // Update the main stickyOrderId to the latest upsell order ID
                gatewayId: result.gateway_id || state.gatewayId,
            };

            // Store the upsell order ID and processing flags based on step for card flow
            if (upsellData.step === 1) {
                updatedState.stickyOrderId_Upsell1 = result.order_id;
                // processed_Upsell_1 will be set by triggerUpsellActions
                updatedState.timestamp_processed_Upsell_1 = new Date().toISOString();
            } else if (upsellData.step === 2) {
                updatedState.stickyOrderId_Upsell2 = result.order_id;
                // processed_Upsell_2 will be set by triggerUpsellActions
                updatedState.timestamp_processed_Upsell_2 = new Date().toISOString();
            } else if (upsellData.step === 3) {
                updatedState.stickyOrderId_Upsell3 = result.order_id;
                // processed_Upsell_3 will be set by triggerUpsellActions
                updatedState.timestamp_processed_Upsell_3 = new Date().toISOString();
            }
            // Add more steps if necessary

            await env.PIXEL_STATE.put(kvKey, JSON.stringify(updatedState));
            console.log(`[UpsellHandler] PIXEL_STATE updated after Card upsell for ${kvKey}. Order ID: ${result.order_id}`);

            await triggerUpsellActions(internal_txn_id, upsellData.step, result, env, ctx, request);

            let nextPagePath = '';
            if (upsellData.step === 1) {
                nextPagePath = '/upsell2';
            } else if (upsellData.step === 2) {
                nextPagePath = '/upsell3';
            } else if (upsellData.step === 3) {
                nextPagePath = '/thank-you'; // Default thank you page path
            }
            
            const nextPageUrl = nextPagePath && state.siteBaseUrl ? new URL(nextPagePath, state.siteBaseUrl).href : undefined;

            return addCorsHeaders(new Response(JSON.stringify({
                success: true,
                message: 'Card upsell processed successfully.',
                orderId: result.order_id,
                data: result,
                internal_txn_id: internal_txn_id,
                next_page_url: nextPageUrl,
            }), { status: 200, headers: { 'Content-Type': 'application/json;charset=UTF-8' } }), request);
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
        }), { status: 500, headers: { 'Content-Type': 'application/json;charset=UTF-8' } }), request);
    }
}

// Removed the declare module block as UpsellRequest.sticky_url_id is now optional in src/types.ts