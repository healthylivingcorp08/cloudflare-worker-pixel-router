import { STICKY_URL_MAP } from '../config'; // Added import
import { Env, PixelState, PaymentData, StickyPayload, EncryptedData } from '../types';
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

        // Use 'any' for flexibility, assuming frontend sends expected structure
        const requestBody = await request.json() as any;
        const { internal_txn_id, targetCampaignId, paymentMethod, ...checkoutPayload } = requestBody;
        // Use 127.0.0.1 as fallback if CF-Connecting-IP is missing, as Sticky.io rejects empty strings.
        const ipAddress = request.headers.get('CF-Connecting-IP') || '127.0.0.1';
        const userAgent = request.headers.get('User-Agent') || '';

        if (!internal_txn_id || !targetCampaignId) {
            const missing = [!internal_txn_id && 'internal_txn_id', !targetCampaignId && 'targetCampaignId'].filter(Boolean).join(', ');
            return addCorsHeaders(new Response(JSON.stringify({ success: false, message: `Missing required fields: ${missing}` }), { status: 400, headers: { 'Content-Type': 'application/json' } }), request);
        }

        stateKey = `txn_${internal_txn_id}`; // Define stateKey here
        console.log(`[CheckoutHandler] Processing checkout for ${internal_txn_id}`);

        // 1. Determine Payment Method
        let determinedPaymentMethod: 'card' | 'paypal' | null = null;
        // Check top-level field first (might be used by PayPal return?)
        if (paymentMethod === 'paypal') {
            determinedPaymentMethod = 'paypal';
        // Check the method field within the payment object sent by the client
        } else if (checkoutPayload.payment?.method === 'credit_card') {
            determinedPaymentMethod = 'card';
        } else {
            console.error(`[CheckoutHandler] Could not determine payment method for ${internal_txn_id}. Body:`, JSON.stringify(requestBody));
            return addCorsHeaders(new Response(JSON.stringify({ success: false, message: 'Could not determine payment method.' }), { status: 400, headers: { 'Content-Type': 'application/json' } }), request);
        }
        console.log(`[CheckoutHandler] Determined payment method: ${determinedPaymentMethod}`);

        // 2. Read and Update State (Payment Method)
        const stateString = await env.PIXEL_STATE.get(stateKey);
        if (!stateString) {
            console.error(`[CheckoutHandler] State not found for ${internal_txn_id}`);
            return addCorsHeaders(new Response(JSON.stringify({ success: false, message: 'Transaction state not found. Please start the process again.' }), { status: 404, headers: { 'Content-Type': 'application/json' } }), request);
        }
        state = JSON.parse(stateString) as PixelState; // Assign to outer scope variable

        state.paymentMethod_Initial = determinedPaymentMethod;
        ctx.waitUntil(
            env.PIXEL_STATE.put(stateKey, JSON.stringify(state))
                .then(() => console.log(`[CheckoutHandler] KV PUT attempted for ${stateKey} (paymentMethod update)`)) // Add confirmation log
                .catch(err => console.error(`[CheckoutHandler] Failed to update KV state (paymentMethod) for ${internal_txn_id}: ${err.message}`))
        );
        console.log(`[CheckoutHandler] Updated paymentMethod_Initial to ${determinedPaymentMethod} for ${internal_txn_id}`);

        // 3. Prepare Payment Details for Sticky Payload
        let paymentFieldsForSticky: Record<string, any> = {}; // Initialize empty object for payment fields
        if (determinedPaymentMethod === 'card' && checkoutPayload.payment) {
            // --- Using RAW card details from payload (INSECURE - FOR LOCAL TESTING ONLY) ---
            console.warn(`[CheckoutHandler] Using RAW card details from payload for ${internal_txn_id}. THIS IS INSECURE.`);
            const paymentFromPayload: PaymentData = checkoutPayload.payment;

            if (
                !paymentFromPayload.cardNumber ||
                !paymentFromPayload.expirationMonth ||
                !paymentFromPayload.expirationYear ||
                !paymentFromPayload.cvv
            ) {
                console.error(`[CheckoutHandler] Missing raw payment details in payload for ${internal_txn_id}`);
                return addCorsHeaders(new Response(JSON.stringify({ success: false, message: 'Missing payment details.' }), { status: 400, headers: { 'Content-Type': 'application/json' } }), request);
            }

            const rawCardNumber = paymentFromPayload.cardNumber.replace(/\s/g, ''); // Ensure no spaces
            const rawMonth = paymentFromPayload.expirationMonth.padStart(2, '0');
            const rawYear = paymentFromPayload.expirationYear.slice(-2); // Get last 2 digits
            const rawExpiryMMYY = `${rawMonth}${rawYear}`;
            const rawCvv = paymentFromPayload.cvv;

            // DEBUG: Log the raw values being prepared for Sticky
            console.log(`[CheckoutHandler] Preparing payment data for Sticky: Card=${rawCardNumber}, Expiry=${rawExpiryMMYY}, CVV=${rawCvv}`);

            // Assign fields directly to the paymentFieldsForSticky object
            paymentFieldsForSticky = {
                creditCardType: getCardType(rawCardNumber), // Determine card type from number (Uppercase)
                creditCardNumber: rawCardNumber,
                expirationDate: rawExpiryMMYY, // Use formatted MMYY
                CVV: rawCvv, // Uppercase CVV matches type
            };
            console.log(`[CheckoutHandler] Raw card details extracted for ${internal_txn_id}`);
            // DEBUG: Log the constructed payment fields object for Sticky
            console.log(`[CheckoutHandler] paymentFieldsForSticky object:`, JSON.stringify(paymentFieldsForSticky));
            // --- End RAW card details ---
        } else if (determinedPaymentMethod === 'paypal') {
            // Add required fields for Sticky.io PayPal Payments flow
            paymentFieldsForSticky = {
                creditCardType: 'paypal', // Required identifier
                // alt_pay_return_url will be added below using request.url
            };
            console.log(`[CheckoutHandler] PayPal payment method selected, adding required fields.`);
        }


        // 4. Construct Sticky.io Payload
        // Use Record<string, any> for flexibility, especially with spread syntax later
        const stickyPayload: Record<string, any> = {
            // Customer Details (Required)
            firstName: checkoutPayload.customer?.firstName,
            lastName: checkoutPayload.customer?.lastName,

            // Billing Details (Required, use customer/shipping if sameAsShipping or billing not provided)
            // Assuming checkoutPayload.customer.shippingAddress exists from frontend structure
            billingFirstName: checkoutPayload.billingSameAsShipping ? checkoutPayload.customer?.firstName : checkoutPayload.billing?.firstName || checkoutPayload.customer?.firstName,
            billingLastName: checkoutPayload.billingSameAsShipping ? checkoutPayload.customer?.lastName : checkoutPayload.billing?.lastName || checkoutPayload.customer?.lastName,
            billingAddress1: checkoutPayload.billingSameAsShipping ? checkoutPayload.customer?.shippingAddress?.address1 : checkoutPayload.billing?.address1 || checkoutPayload.customer?.shippingAddress?.address1,
            billingAddress2: checkoutPayload.billingSameAsShipping ? checkoutPayload.customer?.shippingAddress?.address2 : checkoutPayload.billing?.address2 || checkoutPayload.customer?.shippingAddress?.address2,
            billingCity: checkoutPayload.billingSameAsShipping ? checkoutPayload.customer?.shippingAddress?.city : checkoutPayload.billing?.city || checkoutPayload.customer?.shippingAddress?.city,
            billingState: checkoutPayload.billingSameAsShipping ? checkoutPayload.customer?.shippingAddress?.state : checkoutPayload.billing?.state || checkoutPayload.customer?.shippingAddress?.state,
            billingZip: checkoutPayload.billingSameAsShipping ? checkoutPayload.customer?.shippingAddress?.zip : checkoutPayload.billing?.zip || checkoutPayload.customer?.shippingAddress?.zip,
            billingCountry: checkoutPayload.billingSameAsShipping ? checkoutPayload.customer?.shippingAddress?.country : checkoutPayload.billing?.country || checkoutPayload.customer?.shippingAddress?.country,
            phone: checkoutPayload.customer?.phone, // Required
            email: checkoutPayload.customer?.email, // Required

            // Shipping Details (Required) - Assuming structure from CheckoutForm.tsx
            // Note: shippingId might come from product data, not address data. Using default '2' based on example.
            shippingId: checkoutPayload.products?.[0]?.ship_id ?? checkoutPayload.shipping?.shippingId ?? '2', // REQUIRED - Defaulting to '2'
            shippingAddress1: checkoutPayload.customer?.shippingAddress?.address1,
            shippingAddress2: checkoutPayload.customer?.shippingAddress?.address2,
            shippingCity: checkoutPayload.customer?.shippingAddress?.city,
            shippingState: checkoutPayload.customer?.shippingAddress?.state,
            shippingZip: checkoutPayload.customer?.shippingAddress?.zip,
            shippingCountry: checkoutPayload.customer?.shippingAddress?.country,
            // Correctly determine based on the presence of billingAddress in the payload from frontend
            billingSameAsShipping: checkoutPayload.customer?.billingAddress === null ? 'YES' : 'NO',

            // Transaction Details (Required)
            tranType: 'Sale',
            campaignId: targetCampaignId, // Required
            forceGatewayId: "140", // Force PayPal gateway for testing
            // Map products from checkoutPayload to Sticky.io offers structure (REQUIRED)
            // IMPORTANT: offer_id and billing_model_id MUST be passed from frontend in checkoutPayload.products
            // Ensure we are accessing the correct fields from the 'p' object which represents an item from checkoutPayload.products
            offers: checkoutPayload.products?.map((p: any) => {
                console.log('[CheckoutHandler] Mapping product item from frontend:', JSON.stringify(p)); // DEBUG: Log the item received from frontend
                return {
                    product_id: p.product_id, // CORRECTED: Access product_id sent by frontend
                    offer_id: p.offer_id, // Access offer_id sent by frontend
                    billing_model_id: p.billing_model_id, // Access billing_model_id sent by frontend
                    quantity: p.quantity ?? 1,
                    priceRate: p.priceRate ?? p.price,
                    discountPrice: p.discountPrice ?? p.price,
                    regPrice: p.regPrice ?? p.price,
                    shipPrice: p.shipPrice ?? 0,
                    price: p.price
                };
            }) || [], // Ensure it's an array
            ipAddress: ipAddress, // Required

            // Payment Details (Added via spread below)

            // Tracking Parameters (Optional)
            AFID: state.trackingParams?.affId,
            SID: state.trackingParams?.sub1,
            AFFID: state.trackingParams?.c1,
            C1: state.trackingParams?.c1,
            C2: state.trackingParams?.c2,
            C3: state.trackingParams?.sub2,
            AID: state.trackingParams?.uid,
            click_id: state.trackingParams?.click_id,
            utm_source: state.trackingParams?.utm_source,
            utm_medium: state.trackingParams?.utm_medium,
            utm_campaign: state.trackingParams?.utm_campaign,
            utm_content: state.trackingParams?.utm_content,
            utm_term: state.trackingParams?.utm_term,

            // Add payment fields directly to the payload if it's a card payment
            ...(paymentFieldsForSticky), // Spread payment fields (card or paypal)
            // Add alt_pay_return_url specifically for PayPal, pointing to the upsell page
            ...(determinedPaymentMethod === 'paypal' ? (() => {
                const originalUrl = new URL(request.url);
                let basePath = originalUrl.pathname;
                if (basePath.endsWith('/')) {
                    basePath = basePath.slice(0, -1); // Remove trailing slash if present
                }
                const returnUrl = `${originalUrl.origin}${basePath}/upsell1${originalUrl.search}`;
                console.log(`[CheckoutHandler] Setting alt_pay_return_url for PayPal to: ${returnUrl}`); // Log the constructed URL
                return { alt_pay_return_url: returnUrl };
            })() : {}),
        };


        // Remove undefined and null fields before sending
        const payloadToSend: Record<string, any> = stickyPayload; // Keep as Record for cleanup
        Object.keys(payloadToSend).forEach((key: string) => {
            // Remove undefined and null values, as Sticky might not like them
            if (payloadToSend[key] === undefined || payloadToSend[key] === null) {
                delete payloadToSend[key];
            }
            // Special handling for offers array
            if (key === 'offers' && Array.isArray(payloadToSend[key])) {
                if (payloadToSend[key].length === 0) {
                    console.warn(`[CheckoutHandler] Removing empty 'offers' array from payload for ${internal_txn_id}`);
                    delete payloadToSend[key];
                } else {
                    // Clean each offer item but preserve price fields
                    payloadToSend[key] = payloadToSend[key].map((offer: any) => {
                        const cleanOffer: any = {};
                        Object.keys(offer).forEach((offerKey) => {
                            if (offer[offerKey] !== undefined && offer[offerKey] !== null) {
                                cleanOffer[offerKey] = offer[offerKey];
                            }
                        });
                        return cleanOffer;
                    });
                }
            }
        });

        // Log the campaign ID being sent (check if exists before logging)
        console.log(`[CheckoutHandler] Sending campaignId to Sticky.io: ${payloadToSend.campaignId ?? 'N/A'}`);

        // DEBUG: Log the entire payload being sent to Sticky.io
        console.log('[CheckoutHandler] Final payloadToSend to Sticky:', JSON.stringify(payloadToSend, null, 2)); // Pretty print

        // 5. Call Sticky.io NewOrder API
        // Pass the resolved stickyBaseUrl
        const stickyResponse = await callStickyNewOrder(stickyBaseUrl, payloadToSend, env);

        // 6. Handle Sticky.io Response
        const stickyOrderId = stickyResponse.order_id;
        const gatewayId = stickyResponse.gateway_id; // Extract gateway_id

        if (stickyOrderId && state) { // Check if state is not null
            state.stickyOrderId_Initial = String(stickyOrderId);
            // Await the KV put to ensure it completes before responding
            await env.PIXEL_STATE.put(stateKey, JSON.stringify(state));
            console.log(`[CheckoutHandler] Stored stickyOrderId_Initial ${stickyOrderId} for ${internal_txn_id} (await completed)`);
        }

        if (stickyResponse.response_code === '100') {
            // --- SUCCESS ---
            console.log(`[CheckoutHandler] Sticky.io NewOrder SUCCESS for ${internal_txn_id}, Order ID: ${stickyOrderId}, Gateway ID: ${gatewayId}`); // Log gatewayId
            const triggerResultPromise = triggerInitialActions(internal_txn_id, stickyResponse, env, ctx, request);
            ctx.waitUntil(triggerResultPromise);
            const triggerResult = await triggerResultPromise;

            // Ensure the correct orderId and gatewayId are returned in the response
            const successResponse = {
                success: true,
                orderId: String(stickyOrderId), // Use the variable holding the ID from Sticky
                gatewayId: gatewayId, // Include gateway_id in the response
                clientSideActions: triggerResult.clientSideActions || []
                // Add other necessary fields from stickyResponse if needed by frontend context
            };
            return addCorsHeaders(new Response(JSON.stringify(successResponse), { status: 200, headers: { 'Content-Type': 'application/json' } }), request);

        } else if (determinedPaymentMethod === 'paypal' && stickyResponse.gateway_response?.redirect_url) {
            // --- PAYPAL REDIRECT ---
            // Note: gateway_id might not be present on redirect, handle appropriately if needed later
            const redirectUrl = stickyResponse.gateway_response.redirect_url;
            console.log(`[CheckoutHandler] Sticky.io PayPal REDIRECT for ${internal_txn_id} to: ${redirectUrl}`);
            if (state) { // Check if state is not null
                state.status = 'paypal_redirect';
                ctx.waitUntil(
                    env.PIXEL_STATE.put(stateKey, JSON.stringify(state))
                        .catch(err => console.error(`[CheckoutHandler] Failed to update KV state (paypal_redirect) for ${internal_txn_id}: ${err.message}`))
                );
            }
            console.log(`[CheckoutHandler] KV PUT attempted for ${stateKey} (paypal_redirect status update)`); // Add confirmation log
            const redirectResponse = {
                success: true,
                redirectUrl: redirectUrl,
                orderId: stickyOrderId,
                gatewayId: gatewayId // Include gateway_id if available, might be null/undefined
            };
            return addCorsHeaders(new Response(JSON.stringify(redirectResponse), { status: 200, headers: { 'Content-Type': 'application/json' } }), request);

        } else {
            // --- FAILURE ---
            // Note: gateway_id might not be present on failure, handle appropriately if needed later
            const errorMessage = stickyResponse.error_message || stickyResponse.decline_reason || 'Unknown Sticky.io error';
            console.error(`[CheckoutHandler] Sticky.io NewOrder FAILED for ${internal_txn_id}: ${errorMessage}`, stickyResponse);
            if (state) { // Check if state is not null
                state.status = 'failed';
                ctx.waitUntil(
                    env.PIXEL_STATE.put(stateKey, JSON.stringify(state))
                        .catch(err => console.error(`[CheckoutHandler] Failed to update KV state (failed) for ${internal_txn_id}: ${err.message}`))
                );
            }
            console.log(`[CheckoutHandler] KV PUT attempted for ${stateKey} (failed status update)`); // Add confirmation log
            const errorResponse = {
                success: false,
                message: `Payment failed: ${errorMessage}`,
                details: stickyResponse,
                gatewayId: gatewayId // Include gateway_id if available, might be null/undefined
            };
            const status = (stickyResponse._status >= 500 || !stickyResponse._ok) ? 502 : 400;
            return addCorsHeaders(new Response(JSON.stringify(errorResponse), { status: status, headers: { 'Content-Type': 'application/json' } }), request);
        }

    } catch (error: any) {
        console.error(`[CheckoutHandler] Error processing checkout for ${stateKey}:`, error);
        // Attempt to update state to failed if possible and state was loaded
        if (stateKey && state) { // Check if stateKey is defined and state was loaded
            try {
                // Re-fetch state in case it changed or wasn't loaded correctly before the error
                const currentStateString = await env.PIXEL_STATE.get(stateKey);
                if (currentStateString) {
                    let currentState: PixelState = JSON.parse(currentStateString);
                    currentState.status = 'failed';
                    ctx.waitUntil(
                        env.PIXEL_STATE.put(stateKey, JSON.stringify(currentState))
                            .then(() => console.log(`[CheckoutHandler] KV PUT attempted for ${stateKey} (error handling failed status update)`)) // Add confirmation log
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
