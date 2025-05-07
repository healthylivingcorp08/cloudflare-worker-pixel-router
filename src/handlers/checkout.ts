import { STICKY_URL_MAP } from '../config'; // Added import
import { Env, PixelState, StickyPayload, CheckoutRequestPayload } from '../types'; // Removed PaymentData, EncryptedData, Added CheckoutRequestPayload
import { ExecutionContext } from '@cloudflare/workers-types';
import { addCorsHeaders } from '../middleware/cors';
import { callStickyNewOrder } from '../lib/sticky';
import { decryptData } from '../utils/encryption'; // Keep for potential future use, but not used in this change
import { triggerInitialActions } from '../actions'; // Assuming triggerInitialActions is moved here

// Helper function to determine card type from number (returns uppercase)
function getCardType(cardNumber: string): string {
	if (!cardNumber) return 'UNKNOWN';
	if (cardNumber.startsWith('4')) return 'VISA';
	if (/^5[1-5]/.test(cardNumber)) return 'MASTER'; // Assuming Sticky uses MASTER for Mastercard
	if (/^3[47]/.test(cardNumber)) return 'AMEX';
	if (/^6(?:011|5)/.test(cardNumber)) return 'DISCOVER';
	// Add other card types as needed (ensure they match Sticky.io expected values)
	return 'UNKNOWN';
}

/**
 * Handles POST requests to / (main checkout endpoint).
 * Processes checkout, calls Sticky.io, triggers actions, and updates state.
 */
export async function handleCheckout(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    let stateKey = ''; // Initialize stateKey
    let state: PixelState | null = null; // Initialize state

    try {
        console.log('[CheckoutHandler] Received request');

        // --- Sticky URL ID Handling ---
        const stickyUrlId = request.headers.get('X-Sticky-Url-Id');
        if (!stickyUrlId) {
            console.error('[CheckoutHandler] Missing X-Sticky-Url-Id header');
            return addCorsHeaders(new Response(JSON.stringify({ success: false, message: 'Missing Sticky URL identifier header.' }), { status: 400, headers: { 'Content-Type': 'application/json' } }), request);
        }

        const stickyBaseUrl = STICKY_URL_MAP[stickyUrlId]; // Get the URL string directly
        if (!stickyBaseUrl) { // Check if the lookup was successful
            console.error(`[CheckoutHandler] Invalid or missing Sticky Base URL for ID: ${stickyUrlId}`);
            return addCorsHeaders(new Response(JSON.stringify({ success: false, message: `Invalid Sticky URL identifier: ${stickyUrlId}` }), { status: 400, headers: { 'Content-Type': 'application/json' } }), request);
        }
        console.log(`[CheckoutHandler] Using Sticky Base URL: ${stickyBaseUrl} for ID: ${stickyUrlId}`);
        // --- End Sticky URL ID Handling ---

        // Use CheckoutRequestPayload for type safety
        const requestBody = await request.json() as CheckoutRequestPayload;
        const { internal_txn_id: internalTxnIdFromHeaderOrBody, // Renamed to avoid conflict if already in requestBody
                siteId, // Extract siteId
                paymentMethod, // This is 'card' or 'paypal'
                creditCard, // This is the credit card object
                // targetCampaignId is not a direct field of CheckoutRequestPayload, assume it's campaignId
                campaignId: targetCampaignId, // Use campaignId as targetCampaignId
                siteBaseUrl,
                ...checkoutPayload // Remaining fields are customer, offers, shippingId etc.
              } = requestBody;
        
        // internal_txn_id should primarily come from header for retries, or generated if new.
        // The requestBody might contain an internal_txn_id if frontend is designed that way.
        // For this handler, let's prioritize header, then body, then generate.
        // However, the current logic expects internal_txn_id and targetCampaignId in the body.
        // Let's stick to the existing logic of expecting internal_txn_id in the body for now.
        const final_internal_txn_id = requestBody.internal_txn_id || crypto.randomUUID();


        // Use 127.0.0.1 as fallback if CF-Connecting-IP is missing, as Sticky.io rejects empty strings.
        const ipAddress = request.headers.get('CF-Connecting-IP') || '127.0.0.1';
        const userAgent = request.headers.get('User-Agent') || '';

        // Use the internal_txn_id from the request body, or generate a new one if not provided.
        // The previous logic assumed internal_txn_id was always in the body.
        // A more robust approach might be: header > body > generate.
        // For now, let's keep it simple: if body.internal_txn_id exists, use it, else generate.
        // This also means the frontend MUST send internal_txn_id if it's a retry/resume.
        const current_internal_txn_id = requestBody.internal_txn_id || crypto.randomUUID();

        if (!targetCampaignId) { // siteId is already destructured and checked by STICKY_URL_MAP logic indirectly
            return addCorsHeaders(new Response(JSON.stringify({ success: false, message: `Missing required fields: campaignId (targetCampaignId)` }), { status: 400, headers: { 'Content-Type': 'application/json' } }), request);
        }

        stateKey = current_internal_txn_id; // CORRECTED: Use the actual internal_txn_id as the key
        console.log(`[CheckoutHandler] Processing checkout for internal_txn_id: ${stateKey}`);

        // 1. Determine Payment Method (already done via requestBody.paymentMethod)
        const determinedPaymentMethod = paymentMethod; // 'card' or 'paypal' from CheckoutRequestPayload
        console.log(`[CheckoutHandler] Determined payment method: ${determinedPaymentMethod}`);

        // 2. Initialize or Read State
        let existingStateString = await env.PIXEL_STATE.get(stateKey);
        if (existingStateString) {
            state = JSON.parse(existingStateString) as PixelState;
            console.log(`[CheckoutHandler] Found existing state for ${stateKey}`);
            // Update relevant fields if it's a retry or modification
            state.timestamp_last_updated = new Date().toISOString();
            state.paymentMethod_initial = determinedPaymentMethod;
            state.siteId = siteId; // Ensure siteId is updated/set
            state.affid = requestBody.affid; // Store affid
            state.campaignId = targetCampaignId; // Store campaignId
            // Potentially update customer details if they can change on retry
        } else {
            console.log(`[CheckoutHandler] No existing state found for ${stateKey}, initializing new state.`);
            state = {
                internal_txn_id: stateKey,
                status: 'pending',
                timestamp_created: new Date().toISOString(),
                timestamp_last_updated: new Date().toISOString(),
                siteId: siteId, // Store siteId
                paymentMethod_initial: determinedPaymentMethod,
                customerFirstName: requestBody.customer?.firstName,
                customerLastName: requestBody.customer?.lastName,
                customerEmail: requestBody.customer?.email,
                customerPhone: requestBody.customer?.phone,
                customerAddress: { // Assuming billing address is primary customer address
                    street: requestBody.customer?.address1,
                    city: requestBody.customer?.city,
                    state: requestBody.customer?.state,
                    zip: requestBody.customer?.zip,
                    country: requestBody.customer?.country,
                },
                affid: requestBody.affid,
                campaignId: targetCampaignId,
                // Initialize other fields as needed
            };
        }
        
        // Store/update state in KV
        ctx.waitUntil(
            env.PIXEL_STATE.put(stateKey, JSON.stringify(state))
                .then(() => console.log(`[CheckoutHandler] KV PUT attempted for ${stateKey} (state initialization/update)`))
                .catch(err => console.error(`[CheckoutHandler] Failed to update KV state for ${stateKey}: ${err.message}`))
        );
        console.log(`[CheckoutHandler] State prepared for ${stateKey}`);


        // 3. Prepare Payment Details for Sticky Payload
        let paymentFieldsForSticky: Record<string, any> = {};
        if (determinedPaymentMethod === 'card') {
            if (!creditCard || !creditCard.number || !creditCard.expiryMonth || !creditCard.expiryYear || !creditCard.cvv) {
                console.error(`[CheckoutHandler] Missing credit card details in payload for ${stateKey}`);
                return addCorsHeaders(new Response(JSON.stringify({ success: false, message: 'Missing credit card details.' }), { status: 400, headers: { 'Content-Type': 'application/json' } }), request);
            }
            const rawCardNumber = creditCard.number.replace(/\s/g, '');
            const rawMonth = creditCard.expiryMonth.padStart(2, '0');
            const rawYear = creditCard.expiryYear.slice(-2); // Assuming YYYY input, take last 2 for MMYY
            const rawExpiryMMYY = `${rawMonth}${rawYear}`;
            const rawCvv = creditCard.cvv;

            paymentFieldsForSticky = {
                creditCardType: getCardType(rawCardNumber),
                creditCardNumber: rawCardNumber,
                expirationDate: rawExpiryMMYY,
                CVV: rawCvv,
            };
            console.log(`[CheckoutHandler] Card details extracted for ${stateKey}`);
        } else if (determinedPaymentMethod === 'paypal') {
            paymentFieldsForSticky = {
                creditCardType: 'paypal',
            };
            console.log(`[CheckoutHandler] PayPal payment method selected for ${stateKey}.`);
        }

        let finalEffectiveSiteBaseUrl: string | undefined = siteBaseUrl; // Variable to store the determined site base URL

        // 4. Construct Sticky.io Payload
        const stickyPayload: Record<string, any> = {
            firstName: requestBody.customer?.firstName,
            lastName: requestBody.customer?.lastName,
            billingFirstName: requestBody.customer?.firstName, // Assuming billing is same as customer for simplicity here
            billingLastName: requestBody.customer?.lastName,
            billingAddress1: requestBody.customer?.address1,
            billingAddress2: requestBody.customer?.address2,
            billingCity: requestBody.customer?.city,
            billingState: requestBody.customer?.state,
            billingZip: requestBody.customer?.zip,
            billingCountry: requestBody.customer?.country,
            phone: requestBody.customer?.phone,
            email: requestBody.customer?.email,
            
            shippingId: requestBody.shippingId,
            shippingAddress1: requestBody.shippingAddress?.address1 || requestBody.customer?.address1,
            shippingAddress2: requestBody.shippingAddress?.address2 || requestBody.customer?.address2,
            shippingCity: requestBody.shippingAddress?.city || requestBody.customer?.city,
            shippingState: requestBody.shippingAddress?.state || requestBody.customer?.state,
            shippingZip: requestBody.shippingAddress?.zip || requestBody.customer?.zip,
            shippingCountry: requestBody.shippingAddress?.country || requestBody.customer?.country,
            billingSameAsShipping: requestBody.shippingAddress ? 'NO' : 'YES', // Simplified logic

            tranType: 'Sale',
            campaignId: targetCampaignId,
            offers: requestBody.offers?.map(o => ({
                product_id: o.product_id,
                offer_id: o.offer_id,
                billing_model_id: o.billing_model_id,
                quantity: o.quantity,
                // price fields might need to be sourced from a product config if not in request
            })) || [],
            ipAddress: ipAddress,

            AFID: requestBody.affid, // Directly from requestBody
            SID: requestBody.subid1,
            AFFID: requestBody.subid1, // Often AFFID is same as SID or a specific campaign C-var
            C1: requestBody.subid1,
            C2: requestBody.subid2,
            C3: requestBody.subid3,
            // AID: state.trackingParams?.uid, // If AID is different
            click_id: requestBody.click_id,
            utm_source: requestBody.utm_source,
            utm_medium: requestBody.utm_medium,
            utm_campaign: requestBody.utm_campaign,
            utm_content: requestBody.utm_content,
            utm_term: requestBody.utm_term,

            preserve_gateway: requestBody.preserve_force_gateway || "1",
            ...(requestBody.forceGatewayId && { forceGatewayId: requestBody.forceGatewayId }),
            
            ...(paymentFieldsForSticky),
            
            ...(determinedPaymentMethod === 'paypal' ? (() => {
                const originalUrl = new URL(request.url);
                const workerOrigin = originalUrl.origin;
                let effectiveSiteBaseUrl = requestBody.siteBaseUrl;

                if (!effectiveSiteBaseUrl || typeof effectiveSiteBaseUrl !== 'string' || !effectiveSiteBaseUrl.startsWith('http')) {
                    const requestOriginHeader = request.headers.get('Origin');
                    if (requestOriginHeader && requestOriginHeader !== workerOrigin && requestOriginHeader.startsWith('http')) {
                        effectiveSiteBaseUrl = requestOriginHeader;
                    } else {
                        effectiveSiteBaseUrl = workerOrigin;
                    }
                }
                finalEffectiveSiteBaseUrl = effectiveSiteBaseUrl; // Store for state update
                
                const returnUrlParams = new URLSearchParams(); // Start fresh for PayPal return
                returnUrlParams.set('internal_txn_id', stateKey);
                returnUrlParams.set('sticky_url_id', stickyUrlId); // Pass sticky_url_id for PayPal return handler
                // Add other params if needed by paypalReturn handler, e.g. original orderId if one was created before redirect
                
                // The alt_pay_return_url should point to /api/paypal_return
                const returnUrl = `${env.WORKER_BASE_URL || workerOrigin}/api/paypal_return?${returnUrlParams.toString()}`;
                console.log(`[CheckoutHandler] Setting alt_pay_return_url for PayPal to: ${returnUrl}`);
                return { alt_pay_return_url: returnUrl };
            })() : {}),
        };

        const payloadToSend: Record<string, any> = stickyPayload;
        Object.keys(payloadToSend).forEach((key: string) => {
            if (payloadToSend[key] === undefined || payloadToSend[key] === null) {
                delete payloadToSend[key];
            }
            if (key === 'offers' && Array.isArray(payloadToSend[key]) && payloadToSend[key].length === 0) {
                delete payloadToSend[key];
            }
        });

        console.log('[CheckoutHandler] Final payloadToSend to Sticky:', JSON.stringify(payloadToSend, null, 2));
        const stickyResponse = await callStickyNewOrder(stickyBaseUrl, payloadToSend, env);

        const stickyOrderId = stickyResponse.order_id;
        const gatewayId = stickyResponse.gateway_id;

        if (stickyOrderId && state) {
            state.stickyOrderId_initial = String(stickyOrderId);
            state.gatewayId = gatewayId; // Store gatewayId from initial transaction
            if (finalEffectiveSiteBaseUrl) { // This is the siteBaseUrl for frontend redirects
                state.siteBaseUrl = finalEffectiveSiteBaseUrl;
            }
            // Update state with order ID and gateway ID
            await env.PIXEL_STATE.put(stateKey, JSON.stringify(state))
                .then(() => console.log(`[CheckoutHandler] Stored stickyOrderId_initial, gatewayId, siteBaseUrl for ${stateKey}`))
                .catch(err => console.error(`[CheckoutHandler] Failed to update KV state for ${stateKey}: ${err.message}`));
        }

        if (stickyResponse.response_code === 100 || stickyResponse.response_code === '100') { // Sticky can return string or number
            console.log(`[CheckoutHandler] Sticky.io NewOrder SUCCESS for ${stateKey}, Order ID: ${stickyOrderId}, Gateway ID: ${gatewayId}`);
            // Trigger actions AFTER successful order creation and state update with orderId
            const triggerResultPromise = triggerInitialActions(stateKey, stickyResponse, env, ctx, request);
            ctx.waitUntil(triggerResultPromise); // Ensure actions are processed
            const triggerResult = await triggerResultPromise;


            const successResponse = {
                success: true,
                orderId: String(stickyOrderId),
                gatewayId: gatewayId,
                internal_txn_id: stateKey, // Return the internal_txn_id used/generated
                clientSideActions: triggerResult.clientSideActions || []
            };
            return addCorsHeaders(new Response(JSON.stringify(successResponse), { status: 200, headers: { 'Content-Type': 'application/json' } }), request);

        } else if (determinedPaymentMethod === 'paypal' && stickyResponse.gateway_response?.redirect_url) {
            const redirectUrl = stickyResponse.gateway_response.redirect_url;
            console.log(`[CheckoutHandler] Sticky.io PayPal REDIRECT for ${stateKey} to: ${redirectUrl}`);
            if (state) {
                state.status = 'paypal_redirect'; // Status already updated in types.ts
                state.stickyOrderId_initial = stickyOrderId; // Store potential pre-PayPal order ID if any
                state.gatewayId = gatewayId; // Store gatewayId if any
                ctx.waitUntil(
                    env.PIXEL_STATE.put(stateKey, JSON.stringify(state))
                        .catch(err => console.error(`[CheckoutHandler] Failed to update KV state (paypal_redirect) for ${stateKey}: ${err.message}`))
                );
            }
            const redirectResponse = {
                success: true,
                redirectUrl: redirectUrl,
                orderId: stickyOrderId, // May be null if order created after PayPal approval
                gatewayId: gatewayId,
                internal_txn_id: stateKey
            };
            return addCorsHeaders(new Response(JSON.stringify(redirectResponse), { status: 200, headers: { 'Content-Type': 'application/json' } }), request);

        } else {
            const errorMessage = stickyResponse.error_message || stickyResponse.decline_reason || 'Unknown Sticky.io error';
            console.error(`[CheckoutHandler] Sticky.io NewOrder FAILED for ${stateKey}: ${errorMessage}`, stickyResponse);
            if (state) {
                state.status = 'failed';
                ctx.waitUntil(
                    env.PIXEL_STATE.put(stateKey, JSON.stringify(state))
                        .catch(err => console.error(`[CheckoutHandler] Failed to update KV state (failed) for ${stateKey}: ${err.message}`))
                );
            }
            const errorResponse = {
                success: false,
                message: `Payment failed: ${errorMessage}`,
                details: stickyResponse,
                gatewayId: gatewayId,
                internal_txn_id: stateKey
            };
            const status = (stickyResponse._status && stickyResponse._status >= 500 || !stickyResponse._ok) ? 502 : 400;
            return addCorsHeaders(new Response(JSON.stringify(errorResponse), { status: status, headers: { 'Content-Type': 'application/json' } }), request);
        }

    } catch (error: any) {
        console.error(`[CheckoutHandler] Error processing checkout for ${stateKey}:`, error);
        if (stateKey && state) {
            try {
                const currentStateString = await env.PIXEL_STATE.get(stateKey);
                if (currentStateString) {
                    let currentState: PixelState = JSON.parse(currentStateString);
                    currentState.status = 'failed';
                    currentState.lastError = { timestamp: new Date().toISOString(), message: error.message, handler: 'checkout' };
                    ctx.waitUntil(
                        env.PIXEL_STATE.put(stateKey, JSON.stringify(currentState))
                            .catch(err => console.error(`[CheckoutHandler] Error handling KV PUT failed: ${err.message}`))
                    );
                }
            } catch (kvError) {
                console.error(`[CheckoutHandler] Failed to update state to 'failed' during error handling for ${stateKey}:`, kvError);
            }
        }
        const response = new Response(JSON.stringify({ success: false, message: `Internal server error: ${error.message}` }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        return addCorsHeaders(response, request);
    }
}
