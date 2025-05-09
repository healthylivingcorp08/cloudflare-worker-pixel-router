import { STICKY_CONFIG_MAP } from '../config'; // Added import
import { Env, PixelState, PaymentData, StickyPayload } from '../types'; // Removed EncryptedData
import { ExecutionContext } from '@cloudflare/workers-types';
import { addCorsHeaders } from '../middleware/cors';
import { callStickyNewOrder } from '../lib/sticky';
// import { decryptData } from '../utils/encryption'; // EncryptedData not used, commenting out decryptData import for now
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

        const stickyBaseUrl = STICKY_CONFIG_MAP[stickyUrlId].url; // Get the URL string directly
        if (!stickyBaseUrl) { // Check if the lookup was successful
            console.error(`[CheckoutHandler] Invalid or missing Sticky Base URL for ID: ${stickyUrlId}`);
            return addCorsHeaders(new Response(JSON.stringify({ success: false, message: `Invalid Sticky URL identifier: ${stickyUrlId}` }), { status: 400, headers: { 'Content-Type': 'application/json' } }), request);
        }
        console.log(`[CheckoutHandler] Using Sticky Base URL: ${stickyBaseUrl} for ID: ${stickyUrlId}`);
        // --- End Sticky URL ID Handling ---

        // Use 'any' for flexibility, assuming frontend sends expected structure
        const requestBody = await request.json() as any;
        const { internal_txn_id, targetCampaignId, paymentMethod, siteBaseUrl, ...checkoutPayload } = requestBody;
        // Use 127.0.0.1 as fallback if CF-Connecting-IP is missing, as Sticky.io rejects empty strings.
        const ipAddress = request.headers.get('CF-Connecting-IP') || '127.0.0.1';
        const userAgent = request.headers.get('User-Agent') || '';

const originalUrl = new URL(request.url); // Worker's full request URL
        const workerOrigin = originalUrl.origin; // Worker's origin, e.g., http://127.0.0.1:8787
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

        state.paymentMethod_initial = determinedPaymentMethod; // Corrected to lowercase 'i'
        ctx.waitUntil(
            env.PIXEL_STATE.put(stateKey, JSON.stringify(state))
                .then(() => console.log(`[CheckoutHandler] KV PUT attempted for ${stateKey} (paymentMethod_initial update)`)) // Add confirmation log
                .catch(err => console.error(`[CheckoutHandler] Failed to update KV state (paymentMethod_initial) for ${internal_txn_id}: ${err.message}`))
        );
        console.log(`[CheckoutHandler] Updated paymentMethod_initial to ${determinedPaymentMethod} for ${internal_txn_id}`);

        // 3. Prepare Payment Details for Sticky Payload
        let paymentFieldsForSticky: Record<string, any> = {}; // Initialize empty object for payment fields
        if (determinedPaymentMethod === 'card' && checkoutPayload.payment) {
            // --- Using RAW card details from payload (INSECURE - FOR LOCAL TESTING ONLY) ---
            console.warn(`[CheckoutHandler] Using RAW card details from payload for ${internal_txn_id}. THIS IS INSECURE.`);
            const paymentFromPayload: PaymentData = checkoutPayload.payment;

            if (
                !paymentFromPayload.number || // Corrected to 'number'
                !paymentFromPayload.expiryMonth || // Corrected to 'expiryMonth'
                !paymentFromPayload.expiryYear || // Corrected to 'expiryYear'
                !paymentFromPayload.cvv
            ) {
                console.error(`[CheckoutHandler] Missing raw payment details in payload for ${internal_txn_id}`);
                return addCorsHeaders(new Response(JSON.stringify({ success: false, message: 'Missing payment details.' }), { status: 400, headers: { 'Content-Type': 'application/json' } }), request);
            }

            const rawCardNumber = paymentFromPayload.number.replace(/\s/g, ''); // Corrected to 'number'
            const rawMonth = paymentFromPayload.expiryMonth.padStart(2, '0'); // Corrected to 'expiryMonth'
            const rawYear = paymentFromPayload.expiryYear.slice(-2); // Corrected to 'expiryYear', get last 2 digits
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

        let finalEffectiveSiteBaseUrl: string | undefined; // Variable to store the determined site base URL
// Determine finalEffectiveSiteBaseUrl (this is for state.siteBaseUrl, MUST be frontend URL)
        const siteUrlFromPayload = checkoutPayload.siteBaseUrl; // from request body (line 48)
        const requestOrigin = request.headers.get('Origin');
        const requestReferer = request.headers.get('Referer'); // Get Referer

        if (siteUrlFromPayload && typeof siteUrlFromPayload === 'string' && siteUrlFromPayload.startsWith('http')) {
            finalEffectiveSiteBaseUrl = siteUrlFromPayload;
            console.log(`[CheckoutHandler] Using siteBaseUrl from payload for state.siteBaseUrl: ${finalEffectiveSiteBaseUrl}`);
        } else if (requestReferer && typeof requestReferer === 'string' && requestReferer.startsWith('http')) { // Check Referer next
            finalEffectiveSiteBaseUrl = requestReferer;
            console.log(`[CheckoutHandler] Using Referer header for state.siteBaseUrl: ${finalEffectiveSiteBaseUrl}. Payload siteBaseUrl was: '${siteUrlFromPayload}'`);
        } else if (requestOrigin && requestOrigin !== workerOrigin && typeof requestOrigin === 'string' && requestOrigin.startsWith('http')) {
            finalEffectiveSiteBaseUrl = requestOrigin;
            console.log(`[CheckoutHandler] Using Origin header for state.siteBaseUrl: ${finalEffectiveSiteBaseUrl}. Payload siteBaseUrl was: '${siteUrlFromPayload}', Referer was: '${requestReferer}'`);
        } else {
            // finalEffectiveSiteBaseUrl remains undefined if neither payload nor suitable Origin header provides a frontend URL.
            console.warn(`[CheckoutHandler] Could not determine a valid frontend site base URL from payload ('${siteUrlFromPayload}'), Referer ('${requestReferer}'), or Origin header ('${requestOrigin}'). state.siteBaseUrl will be undefined. This is critical for PayPal return.`);
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
            // forceGatewayId: "140", // Force PayPal gateway for testing
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
            click_id: state.trackingParams?.clickId,
            utm_source: state.trackingParams?.utmSource,
            utm_medium: state.trackingParams?.utmMedium,
            utm_campaign: state.trackingParams?.utmCampaign,
            utm_content: state.trackingParams?.utmContent,
            utm_term: state.trackingParams?.utmTerm,

            preserve_force_gateway: "1", // Renamed parameter
 
            // Add payment fields directly to the payload if it's a card payment
            ...(paymentFieldsForSticky), // Spread payment fields (card or paypal)
            // Add alt_pay_return_url specifically for PayPal, pointing to the upsell page
            ...(determinedPaymentMethod === 'paypal' ? (() => {
                // For constructing alt_pay_return_url (which points to the WORKER):
                // finalEffectiveSiteBaseUrl is now determined earlier.
                // workerOrigin is now defined globally within the function.
                const workerApiBase = env.WORKER_BASE_URL || workerOrigin; // This is correct for alt_pay_return_url's base

                const returnUrlParams = new URLSearchParams();
                returnUrlParams.set('internal_txn_id', internal_txn_id);
                // stickyUrlId is from request.headers.get('X-Sticky-Url-Id') at the top of the handler
                if (stickyUrlId) {
                    returnUrlParams.set('sticky_url_id', stickyUrlId);
                }
                // This URL must point to the WORKER's endpoint that handles PayPal returns
                const payPalReturnWorkerEndpoint = `${workerApiBase}/api/checkout/paypal-return?${returnUrlParams.toString()}`;
                console.log(`[CheckoutHandler] Setting alt_pay_return_url for PayPal to worker endpoint: ${payPalReturnWorkerEndpoint}`);
                return { alt_pay_return_url: payPalReturnWorkerEndpoint };
            })() : {}),
        };


        // Remove undefined and null fields before sending
        const payloadToSend: Record<string, any> = stickyPayload; // Keep as Record for cleanup
if (state) {
            const sourceUrl = state.initialUrl || state.siteBaseUrl; // Prioritize initialUrl
            if (sourceUrl) {
                payloadToSend.website = `${sourceUrl}`;
            } else {
                payloadToSend.website = `Initial order (source URL not captured in state)`;
            }
        } else {
            payloadToSend.website = `Initial order (state not available to determine source URL)`;
        }
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

        if (state) { // Check if state is not null
            if (stickyOrderId) {
                state.stickyOrderId_initial = String(stickyOrderId);
            }
            if (gatewayId) { // Also store gatewayId if available
                state.gatewayId = gatewayId;
            }
            if (finalEffectiveSiteBaseUrl) {
                state.siteBaseUrl = finalEffectiveSiteBaseUrl;
            }

            // Store customer details if available from the initial checkout payload
            if (checkoutPayload.customer) {
                state.customerFirstName = checkoutPayload.customer.firstName || state.customerFirstName;
                state.customerLastName = checkoutPayload.customer.lastName || state.customerLastName;
                state.customerEmail = checkoutPayload.customer.email || state.customerEmail;
                state.customerPhone = checkoutPayload.customer.phone || state.customerPhone;

                if (checkoutPayload.customer.shippingAddress) {
                    let fullStreet = checkoutPayload.customer.shippingAddress.address1 || '';
                    if (checkoutPayload.customer.shippingAddress.address2) {
                        fullStreet += ` ${checkoutPayload.customer.shippingAddress.address2}`;
                    }
                    state.customerAddress = {
                        street: fullStreet.trim() || undefined, // Store concatenated street, or undefined if empty
                        city: checkoutPayload.customer.shippingAddress.city,
                        state: checkoutPayload.customer.shippingAddress.state,
                        zip: checkoutPayload.customer.shippingAddress.zip,
                        country: checkoutPayload.customer.shippingAddress.country,
                    };
                } else if (checkoutPayload.billing) { // Fallback to billing if shipping not present but billing is
                    let fullStreet = checkoutPayload.billing.address1 || '';
                    if (checkoutPayload.billing.address2) {
                        fullStreet += ` ${checkoutPayload.billing.address2}`;
                    }
                    state.customerAddress = {
                        street: fullStreet.trim() || undefined, // Store concatenated street, or undefined if empty
                        city: checkoutPayload.billing.city,
                        state: checkoutPayload.billing.state,
                        zip: checkoutPayload.billing.zip,
                        country: checkoutPayload.billing.country,
                    };
                }
                console.log(`[CheckoutHandler] Preparing to store customer details in state for ${internal_txn_id}:`, {
                    firstName: state.customerFirstName,
                    email: state.customerEmail,
                    addressCity: state.customerAddress?.city
                });
            }
            
            // This initial state update is important before any redirect or direct success response.
            // It captures order ID, gateway, site base, and customer details.
            // For PayPal redirect, status will be updated again.
            // For direct success, this is the main state update before actions.
            // Make the KV put synchronous to ensure it completes.
            await env.PIXEL_STATE.put(stateKey, JSON.stringify(state))
                .then(() => console.log(`[CheckoutHandler] Stored initial order details (ID, Gateway, SiteBase, Customer) for ${internal_txn_id} (synchronous)`))
                .catch(err => console.error(`[CheckoutHandler] Failed to update KV state (initial order details) for ${internal_txn_id}: ${err.message}`));
        }


        if (stickyResponse.response_code === '100') {
            // --- SUCCESS (Direct, e.g., Card payment) ---
            console.log(`[CheckoutHandler] Sticky.io NewOrder DIRECT SUCCESS for ${internal_txn_id}, Order ID: ${stickyOrderId}, Gateway ID: ${gatewayId}`);
            
            // State already updated with customer details, orderId, gatewayId etc.
            // Trigger actions
            const triggerResultPromise = triggerInitialActions(internal_txn_id, stickyResponse, env, ctx, request);
            ctx.waitUntil(triggerResultPromise); // Allow actions to run in background
            const triggerResult = await triggerResultPromise; // Wait for result if needed for response

            const successResponse = {
                success: true,
                orderId: String(stickyOrderId),
                gatewayId: gatewayId,
                clientSideActions: triggerResult.clientSideActions || []
            };
            return addCorsHeaders(new Response(JSON.stringify(successResponse), { status: 200, headers: { 'Content-Type': 'application/json' } }), request);

        } else if (determinedPaymentMethod === 'paypal' && stickyResponse.gateway_response?.redirect_url) {
            // --- PAYPAL REDIRECT ---
            const redirectUrl = stickyResponse.gateway_response.redirect_url;
            console.log(`[CheckoutHandler] Sticky.io PayPal REDIRECT for ${internal_txn_id} to: ${redirectUrl}`);
            
            if (state) { // State should exist and have been updated with customer details already
                state.status = 'paypal_redirect'; // Update status for PayPal flow
                // stickyOrderId_initial, gatewayId, siteBaseUrl, customer details should already be in state from the block above.
                // Log current state being saved for PayPal redirect
                console.log(`[CheckoutHandler] Updating PIXEL_STATE for PayPal redirect. Key: ${stateKey}, Status: ${state.status}, PaymentMethod: ${state.paymentMethod_initial}, SiteBaseUrl: ${state.siteBaseUrl}, StickyOrderIdInitial: ${state.stickyOrderId_initial}, GatewayID: ${state.gatewayId}, CustomerEmail: ${state.customerEmail}`);

                await env.PIXEL_STATE.put(stateKey, JSON.stringify(state))
                    .then(() => console.log(`[CheckoutHandler] PIXEL_STATE update (paypal_redirect status) successful for ${stateKey}`))
                    .catch(err => {
                        console.error(`[CheckoutHandler] CRITICAL: Failed to update KV state (paypal_redirect status) for ${stateKey}: ${err.message}. Subsequent PayPal return may fail.`);
                    });
            } else {
                // This case should ideally not happen if state was loaded correctly earlier.
                console.error(`[CheckoutHandler] State object is null during PayPal redirect handling for ${stateKey}. This is unexpected.`);
            }

            const redirectResponse = {
                success: true,
                redirectUrl: redirectUrl,
                orderId: stickyOrderId, // May be null if Sticky only provides it on return
                gatewayId: gatewayId    // May be null
            };
            return addCorsHeaders(new Response(JSON.stringify(redirectResponse), { status: 200, headers: { 'Content-Type': 'application/json' } }), request);

        } else {
            // --- FAILURE (Sticky.io NewOrder failed) ---
            const errorMessage = stickyResponse.error_message || stickyResponse.decline_reason || 'Unknown Sticky.io error';
            console.error(`[CheckoutHandler] Sticky.io NewOrder FAILED for ${internal_txn_id}: ${errorMessage}`, stickyResponse);
            
            if (state) { // State should exist
                state.status = 'failed';
                // Customer details might have been set in state already, which is fine.
                // This PUT is to ensure 'failed' status is recorded.
                ctx.waitUntil( // Can be async as it's an error path
                    env.PIXEL_STATE.put(stateKey, JSON.stringify(state))
                        .then(() => console.log(`[CheckoutHandler] PIXEL_STATE update (NewOrder failed status) successful for ${stateKey}`))
                        .catch(err => console.error(`[CheckoutHandler] Failed to update KV state (NewOrder failed status) for ${internal_txn_id}: ${err.message}`))
                );
            }

            const errorResponse = {
                success: false,
                message: `Payment failed: ${errorMessage}`,
                details: stickyResponse,
                gatewayId: gatewayId
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
