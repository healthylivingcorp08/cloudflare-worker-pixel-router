import { Env, PixelState, PaymentData, StickyPayload, EncryptedData } from '../types';
import { ExecutionContext } from '@cloudflare/workers-types';
import { addCorsHeaders } from '../middleware/cors';
import { callStickyNewOrder } from '../lib/sticky';
import { decryptData } from '../utils/encryption'; // Assuming decryptData is moved here
import { triggerInitialActions } from '../actions'; // Assuming triggerInitialActions is moved here

/**
 * Handles POST requests to / (main checkout endpoint).
 * Processes checkout, calls Sticky.io, triggers actions, and updates state.
 */
export async function handleCheckout(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    let stateKey = ''; // Initialize stateKey
    let state: PixelState | null = null; // Initialize state

    try {
        console.log('[CheckoutHandler] Received request');
        const requestBody = await request.json() as any; // Use 'any' for flexibility
        const { internal_txn_id, targetCampaignId, paymentMethod, ...checkoutPayload } = requestBody;
        const ipAddress = request.headers.get('CF-Connecting-IP') || '';
        const userAgent = request.headers.get('User-Agent') || '';

        if (!internal_txn_id || !targetCampaignId) {
            const missing = [!internal_txn_id && 'internal_txn_id', !targetCampaignId && 'targetCampaignId'].filter(Boolean).join(', ');
            return addCorsHeaders(new Response(JSON.stringify({ success: false, message: `Missing required fields: ${missing}` }), { status: 400, headers: { 'Content-Type': 'application/json' } }), request);
        }

        stateKey = `txn_${internal_txn_id}`; // Define stateKey here
        console.log(`[CheckoutHandler] Processing checkout for ${internal_txn_id}`);

        // 1. Determine Payment Method
        let determinedPaymentMethod: 'card' | 'paypal' | null = null;
        if (paymentMethod === 'paypal') {
            determinedPaymentMethod = 'paypal';
        } else if (checkoutPayload.payment?.cardType || checkoutPayload.payment?.encryptedCard) {
            determinedPaymentMethod = 'card';
        } else {
            console.error(`[CheckoutHandler] Could not determine payment method for ${internal_txn_id}`);
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
                .catch(err => console.error(`[CheckoutHandler] Failed to update KV state (paymentMethod) for ${internal_txn_id}: ${err.message}`))
        );
        console.log(`[CheckoutHandler] Updated paymentMethod_Initial to ${determinedPaymentMethod} for ${internal_txn_id}`);

        // 3. Decrypt Card Details if necessary
        let paymentDataForSticky: PaymentData | undefined;
        if (determinedPaymentMethod === 'card' && checkoutPayload.payment) {
            if (!env.ENCRYPTION_SECRET) {
                console.error(`[CheckoutHandler] ENCRYPTION_SECRET is not configured for ${internal_txn_id}.`);
                return addCorsHeaders(new Response(JSON.stringify({ success: false, message: 'Server configuration error [Encryption].' }), { status: 500, headers: { 'Content-Type': 'application/json' } }), request);
            }

            const paymentToDecrypt: PaymentData = { ...checkoutPayload.payment };
            paymentDataForSticky = { cardType: paymentToDecrypt.cardType };

            try {
                if (paymentToDecrypt.encryptedCard) {
                    const decryptedCard = await decryptData(paymentToDecrypt.encryptedCard as unknown as EncryptedData, env);
                    if (typeof decryptedCard !== 'string') throw new Error('Decrypted card number is not a string');
                    paymentDataForSticky.creditCardNumber = decryptedCard;
                }
                if (paymentToDecrypt.encryptedExpiry) {
                    const decryptedExpiry = await decryptData(paymentToDecrypt.encryptedExpiry as unknown as EncryptedData, env);
                    if (typeof decryptedExpiry !== 'string') throw new Error('Decrypted expiry is not a string');
                    paymentDataForSticky.expirationDate = decryptedExpiry.replace('/', '');
                }
                if (paymentToDecrypt.encryptedCvv) {
                    const decryptedCvv = await decryptData(paymentToDecrypt.encryptedCvv as unknown as EncryptedData, env);
                    if (typeof decryptedCvv !== 'string') throw new Error('Decrypted CVV is not a string');
                    paymentDataForSticky.CVV = decryptedCvv;
                }
                console.log(`[CheckoutHandler] Card details decrypted for ${internal_txn_id}`);
            } catch (decryptionError: any) {
                console.error(`[CheckoutHandler] Failed to decrypt card details for ${internal_txn_id}: ${decryptionError.message}`);
                return addCorsHeaders(new Response(JSON.stringify({ success: false, message: 'Invalid payment details provided.' }), { status: 400, headers: { 'Content-Type': 'application/json' } }), request);
            }
        }

        // 4. Construct Sticky.io Payload
        const stickyPayload: StickyPayload = {
            firstName: checkoutPayload.customer?.firstName,
            lastName: checkoutPayload.customer?.lastName,
            billingFirstName: checkoutPayload.billing?.firstName || checkoutPayload.customer?.firstName,
            billingLastName: checkoutPayload.billing?.lastName || checkoutPayload.customer?.lastName,
            billingAddress1: checkoutPayload.billing?.address1,
            billingAddress2: checkoutPayload.billing?.address2,
            billingCity: checkoutPayload.billing?.city,
            billingState: checkoutPayload.billing?.state,
            billingZip: checkoutPayload.billing?.zip,
            billingCountry: checkoutPayload.billing?.country,
            phone: checkoutPayload.customer?.phone,
            email: checkoutPayload.customer?.email,
            shippingId: checkoutPayload.shipping?.shippingId,
            shippingAddress1: checkoutPayload.shipping?.address1,
            shippingAddress2: checkoutPayload.shipping?.address2,
            shippingCity: checkoutPayload.shipping?.city,
            shippingState: checkoutPayload.shipping?.state,
            shippingZip: checkoutPayload.shipping?.zip,
            shippingCountry: checkoutPayload.shipping?.country,
            billingSameAsShipping: checkoutPayload.billingSameAsShipping ? 'YES' : 'NO',
            tranType: 'Sale',
            payment: determinedPaymentMethod === 'card' ? paymentDataForSticky : { paymentType: 'paypal' },
            campaignId: targetCampaignId,
            offers: checkoutPayload.offers,
            ipAddress: ipAddress,
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
        };

        // Remove undefined fields
        const payloadToSend = stickyPayload as Record<string, any>;
        Object.keys(payloadToSend).forEach(key => payloadToSend[key] === undefined && delete payloadToSend[key]);
        if (payloadToSend.payment && typeof payloadToSend.payment === 'object') {
            const paymentPayload = payloadToSend.payment as Record<string, any>;
            Object.keys(paymentPayload).forEach(key => paymentPayload[key] === undefined && delete paymentPayload[key]);
        }

        // 5. Call Sticky.io NewOrder API
        const stickyResponse = await callStickyNewOrder(payloadToSend, env);

        // 6. Handle Sticky.io Response
        const stickyOrderId = stickyResponse.order_id;

        if (stickyOrderId && state) { // Check if state is not null
            state.stickyOrderId_Initial = String(stickyOrderId);
            ctx.waitUntil(
                env.PIXEL_STATE.put(stateKey, JSON.stringify(state))
                    .catch(err => console.error(`[CheckoutHandler] Failed to update KV state (stickyOrderId) for ${internal_txn_id}: ${err.message}`))
            );
            console.log(`[CheckoutHandler] Stored stickyOrderId_Initial ${stickyOrderId} for ${internal_txn_id}`);
        }

        if (stickyResponse.response_code === '100') {
            // --- SUCCESS ---
            console.log(`[CheckoutHandler] Sticky.io NewOrder SUCCESS for ${internal_txn_id}, Order ID: ${stickyOrderId}`);
            const triggerResultPromise = triggerInitialActions(internal_txn_id, stickyResponse, env, ctx, request);
            ctx.waitUntil(triggerResultPromise);
            const triggerResult = await triggerResultPromise;

            const successResponse = {
                success: true,
                orderId: stickyOrderId,
                clientSideActions: triggerResult.clientSideActions || []
            };
            return addCorsHeaders(new Response(JSON.stringify(successResponse), { status: 200, headers: { 'Content-Type': 'application/json' } }), request);

        } else if (determinedPaymentMethod === 'paypal' && stickyResponse.gateway_response?.redirect_url) {
            // --- PAYPAL REDIRECT ---
            const redirectUrl = stickyResponse.gateway_response.redirect_url;
            console.log(`[CheckoutHandler] Sticky.io PayPal REDIRECT for ${internal_txn_id} to: ${redirectUrl}`);
            if (state) { // Check if state is not null
                state.status = 'paypal_redirect';
                ctx.waitUntil(
                    env.PIXEL_STATE.put(stateKey, JSON.stringify(state))
                        .catch(err => console.error(`[CheckoutHandler] Failed to update KV state (paypal_redirect) for ${internal_txn_id}: ${err.message}`))
                );
            }
            const redirectResponse = {
                success: true,
                redirectUrl: redirectUrl,
                orderId: stickyOrderId
            };
            return addCorsHeaders(new Response(JSON.stringify(redirectResponse), { status: 200, headers: { 'Content-Type': 'application/json' } }), request);

        } else {
            // --- FAILURE ---
            const errorMessage = stickyResponse.error_message || stickyResponse.decline_reason || 'Unknown Sticky.io error';
            console.error(`[CheckoutHandler] Sticky.io NewOrder FAILED for ${internal_txn_id}: ${errorMessage}`, stickyResponse);
            if (state) { // Check if state is not null
                state.status = 'failed';
                ctx.waitUntil(
                    env.PIXEL_STATE.put(stateKey, JSON.stringify(state))
                        .catch(err => console.error(`[CheckoutHandler] Failed to update KV state (failed) for ${internal_txn_id}: ${err.message}`))
                );
            }
            const errorResponse = {
                success: false,
                message: `Payment failed: ${errorMessage}`,
                details: stickyResponse
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
                    ctx.waitUntil(env.PIXEL_STATE.put(stateKey, JSON.stringify(currentState)));
                }
            } catch (kvError) {
                console.error(`[CheckoutHandler] Failed to update state to 'failed' during error handling for ${stateKey}:`, kvError);
            }
        }
        const response = new Response(JSON.stringify({ success: false, message: `Internal server error: ${error.message}` }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        return addCorsHeaders(response, request);
    }
}