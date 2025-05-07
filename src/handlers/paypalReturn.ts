import { Env, PixelState } from '../types';
import { ExecutionContext } from '@cloudflare/workers-types';
// import { logError, logInfo } from '../logger'; // Assuming logger exists - Replaced with console
import { triggerInitialActions } from '../actions'; // Will be needed later
import { callStickyOrderView } from '../lib/sticky'; // Corrected import name
import { STICKY_URL_MAP } from '../config'; // For STICKY_API_URL selection

/**
 * Handles the return from PayPal after a checkout attempt.
 * Verifies the transaction status with Sticky.io and triggers initial actions if successful.
 */
export async function handlePaypalReturn(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const internal_txn_id = url.searchParams.get('internal_txn_id');
    const stickyUrlIdFromParam = url.searchParams.get('sticky_url_id'); // Get sticky_url_id from params

    console.log('PayPal Return Handler: Started', { internal_txn_id, stickyUrlIdFromParam });

    if (!internal_txn_id) {
        console.error('PayPal Return Handler: Missing internal_txn_id query parameter');
        return Response.redirect(url.origin + '/checkout?error=paypal_missing_id', 302);
    }

    // Determine Sticky API URL
    const stickyBaseUrl = stickyUrlIdFromParam ? STICKY_URL_MAP[stickyUrlIdFromParam] : env.STICKY_API_URL;
    if (!stickyBaseUrl) {
        console.error(`[PayPalReturnHandler] Sticky Base URL not found for ID: ${stickyUrlIdFromParam} or default. internal_txn_id: ${internal_txn_id}`);
        return Response.redirect(url.origin + `/checkout?error=paypal_config_error&internal_txn_id=${internal_txn_id}`, 302);
    }
    console.log(`[PayPalReturnHandler] Using Sticky Base URL: ${stickyBaseUrl} for internal_txn_id: ${internal_txn_id}`);


    try {
        const stateString = await env.PIXEL_STATE.get(internal_txn_id);
        if (!stateString) {
            console.error('PayPal Return Handler: State not found in KV for', { internal_txn_id });
            return Response.redirect(url.origin + `/checkout?error=paypal_invalid_session&internal_txn_id=${internal_txn_id}`, 302);
        }

        const state: PixelState = JSON.parse(stateString);
        console.log('PayPal Return Handler: Found state', { internal_txn_id, status: state.status, paymentMethod_initial: state.paymentMethod_initial });

        const paypalTransactionId = url.searchParams.get('transactionID'); // PayPal often uses 'transactionID'
        const paypalPayerID = url.searchParams.get('PayerID');
        // Sticky.io might also pass its own orderId and gatewayId in the return URL if it proxies the return
        const stickyOrderIdFromPaypalReturn = url.searchParams.get('orderId'); 
        const gatewayIdFromPaypalReturn = url.searchParams.get('gatewayId');


        if (paypalTransactionId || paypalPayerID || stickyOrderIdFromPaypalReturn || gatewayIdFromPaypalReturn) {
            console.log('PayPal Return Handler: Found PayPal/Sticky parameters in URL', { internal_txn_id, paypalTransactionId, paypalPayerID, stickyOrderIdFromPaypalReturn, gatewayIdFromPaypalReturn });
            state.paypalTransactionId = paypalTransactionId || state.paypalTransactionId;
            state.paypalPayerId = paypalPayerID || state.paypalPayerId;
            state.stickyOrderIdFromPaypalReturn = stickyOrderIdFromPaypalReturn || state.stickyOrderIdFromPaypalReturn;
            state.gatewayIdFromPaypalReturn = gatewayIdFromPaypalReturn || state.gatewayIdFromPaypalReturn;
            
            ctx.waitUntil(
                env.PIXEL_STATE.put(internal_txn_id, JSON.stringify(state))
                    .then(() => console.log('PayPal Return Handler: Successfully stored PayPal/Sticky parameters in PIXEL_STATE', { internal_txn_id }))
                    .catch(err => console.error('PayPal Return Handler: Failed to store PayPal/Sticky parameters in PIXEL_STATE', { internal_txn_id, error: err.message }))
            );
        } else {
            console.log('PayPal Return Handler: No new PayPal/Sticky parameters (transactionID, PayerID, orderId, gatewayId) found in URL to update state with.', { internal_txn_id });
        }

        if (state.processedInitial) {
            console.log('PayPal Return Handler: Initial actions already processed for', { internal_txn_id });
            // If already processed, redirect to the next logical step, which could be an upsell or confirmation
            // For now, let's assume if processed, it should go to confirmation or the current upsell step if that logic exists
            // This redirect needs to be consistent with the funnel logic.
            // For testing, let's assume upsell1 if not confirmed, else confirmation.
            const nextStepUrl = new URL(url.origin);
            // This logic needs to be more robust, potentially reading funnel state
            nextStepUrl.pathname = state.confirmedStickyOrderId ? '/confirmation' : '/upsell1'; 
            nextStepUrl.searchParams.set('internal_txn_id', internal_txn_id);
            if (state.stickyOrderId_initial) {
                nextStepUrl.searchParams.set('orderId', state.stickyOrderId_initial);
            }
            console.log(`[PayPalReturnHandler] Already processed, redirecting to: ${nextStepUrl.toString()}`);
            return Response.redirect(nextStepUrl.toString(), 302);
        }

        if (!state.stickyOrderId_initial) {
            console.error('PayPal Return Handler: Missing stickyOrderId_initial in state for', { internal_txn_id });
            return Response.redirect(url.origin + `/checkout?error=paypal_missing_initial_order_id&internal_txn_id=${internal_txn_id}`, 302);
        }

        console.log('PayPal Return Handler: Calling Sticky.io order_view for', { internal_txn_id, stickyOrderId: state.stickyOrderId_initial });
        const orderViewResponse = await callStickyOrderView(stickyBaseUrl, [state.stickyOrderId_initial!], env);

        const isOrderSuccessful = orderViewResponse?.data?.[0]?.order_status === 'approved';

        if (isOrderSuccessful) {
            console.log('PayPal Return Handler: Sticky.io order confirmed successful for', { internal_txn_id, stickyOrderId: state.stickyOrderId_initial });

            const confirmedStickyOrderId = orderViewResponse?.data?.[0]?.order_id;
            if (confirmedStickyOrderId) {
                state.confirmedStickyOrderId = confirmedStickyOrderId;
                console.log('PayPal Return Handler: Extracted confirmedStickyOrderId', { internal_txn_id, confirmedStickyOrderId });
                // No immediate PIXEL_STATE.put here, triggerInitialActions will update state including processed_Initial
            } else {
                console.warn('PayPal Return Handler: Could not extract confirmed_order_id from Sticky.io response', { internal_txn_id, orderViewResponse });
            }

            // Trigger Initial Actions. This will set state.processedInitial = true
            // Pass the original request object for getActionKeys
            await triggerInitialActions(internal_txn_id, orderViewResponse, env, ctx, request);
            
            // After actions, state in KV is updated by triggerInitialActions. Re-fetch for redirect.
            const finalStateString = await env.PIXEL_STATE.get(internal_txn_id);
            const finalState: PixelState = finalStateString ? JSON.parse(finalStateString) : state; // fallback to in-memory state if fetch fails

            console.log('PayPal Return Handler: Initial actions triggered for', { internal_txn_id });

            // Determine redirect: Upsell 1 or Confirmation
            // This should ideally be based on funnel configuration.
            // For now, always redirect to upsell1 after successful PayPal initial checkout.
            const redirectUrl = new URL(url.origin);
            redirectUrl.pathname = '/upsell1'; // Go to upsell1
            redirectUrl.searchParams.set('internal_txn_id', internal_txn_id);
            if (finalState.stickyOrderId_initial) {
                redirectUrl.searchParams.set('orderId', finalState.stickyOrderId_initial); // This is the initial Sticky order ID
            }
            // Pass sticky_url_id to upsell page if it was present
            if (stickyUrlIdFromParam) {
                redirectUrl.searchParams.set('sticky_url_id', stickyUrlIdFromParam);
            }


            console.log(`[PayPalReturnHandler] Redirecting to Upsell 1: ${redirectUrl.toString()}`);
            return Response.redirect(redirectUrl.toString(), 302);

        } else {
            const stickyStatus = orderViewResponse?.data?.[0]?.order_status || 'unknown';
            console.log('PayPal Return Handler: Sticky.io order not successful (or status unknown)', { internal_txn_id, stickyOrderId: state.stickyOrderId_initial, stickyStatus });

            const updatedState: PixelState = {
                ...state,
                status: stickyStatus === 'pending' ? 'pending' : 'failed',
            };
            ctx.waitUntil(
                env.PIXEL_STATE.put(internal_txn_id, JSON.stringify(updatedState))
                    .then(() => console.log('PayPal Return Handler: Updated KV state to failed/pending for', { internal_txn_id }))
                    .catch(err => console.error('PayPal Return Handler: Failed to update KV state', { internal_txn_id, error: err.message }))
            );

            const errorParam = stickyStatus === 'pending' ? 'paypal_pending' : 'paypal_failed';
            const errorRedirectUrl = new URL(url.origin);
            errorRedirectUrl.pathname = '/checkout';
            errorRedirectUrl.searchParams.set('error', errorParam);
            errorRedirectUrl.searchParams.set('internal_txn_id', internal_txn_id);
            if (state.stickyOrderId_initial) {
                errorRedirectUrl.searchParams.set('orderId', state.stickyOrderId_initial);
            }
            if (stickyUrlIdFromParam) {
                errorRedirectUrl.searchParams.set('sticky_url_id', stickyUrlIdFromParam);
            }
            console.log(`[PayPalReturnHandler] Order not successful, redirecting to checkout with error: ${errorRedirectUrl.toString()}`);
            return Response.redirect(errorRedirectUrl.toString(), 302);
        }

    } catch (error: any) {
        console.error('PayPal Return Handler: Uncaught error', { internal_txn_id, error: error.message, stack: error.stack });
        const genericErrorUrl = new URL(url.origin);
        genericErrorUrl.pathname = '/checkout';
        genericErrorUrl.searchParams.set('error', 'paypal_internal_error');
        if (internal_txn_id) {
            genericErrorUrl.searchParams.set('internal_txn_id', internal_txn_id);
        }
        if (stickyUrlIdFromParam) {
            genericErrorUrl.searchParams.set('sticky_url_id', stickyUrlIdFromParam);
        }
        return Response.redirect(genericErrorUrl.toString(), 302);
    }
}