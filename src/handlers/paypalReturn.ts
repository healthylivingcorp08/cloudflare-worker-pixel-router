import { Env, PixelState } from '../types';
import { ExecutionContext } from '@cloudflare/workers-types';
// import { logError, logInfo } from '../logger'; // Assuming logger exists - Replaced with console
import { triggerInitialActions } from '../actions'; // Will be needed later
import { callStickyOrderView } from '../lib/sticky'; // Corrected import name

/**
 * Handles the return from PayPal after a checkout attempt.
 * Verifies the transaction status with Sticky.io and triggers initial actions if successful.
 */
export async function handlePaypalReturn(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const internal_txn_id = url.searchParams.get('internal_txn_id');

    console.log('PayPal Return Handler: Started', { internal_txn_id });

    if (!internal_txn_id) {
        console.error('PayPal Return Handler: Missing internal_txn_id query parameter');
        // Redirect to a generic error page or the checkout page with an error
        // Redirect to checkout page with specific error. URL might need to be configurable.
        return Response.redirect(url.origin + '/checkout?error=paypal_missing_id', 302);
    }

    try {
        // 1. Fetch state from KV
        const stateString = await env.PIXEL_STATE.get(internal_txn_id);
        if (!stateString) {
            console.error('PayPal Return Handler: State not found in KV for', { internal_txn_id });
            // Redirect to an error page indicating the session expired or is invalid
            // Redirect to checkout page with specific error. URL might need to be configurable.
            return Response.redirect(url.origin + '/checkout?error=paypal_invalid_session', 302);
        }

        const state: PixelState = JSON.parse(stateString);
        console.log('PayPal Return Handler: Found state', { internal_txn_id, status: state.status });

        // 2. Check if already processed
        if (state.processed_Initial) {
            console.log('PayPal Return Handler: Initial actions already processed for', { internal_txn_id });
            // Redirect to confirmation page, assuming success if already processed
            // Redirect to confirmation page. URL structure might need to be configurable.
            return Response.redirect(url.origin + `/confirmation?orderId=${state.stickyOrderId_Initial || 'unknown'}`, 302);
        }

        // 3. Check for Sticky.io Order ID
        if (!state.stickyOrderId_Initial) {
            console.error('PayPal Return Handler: Missing stickyOrderId_Initial in state for', { internal_txn_id });
            // This indicates a potential issue during the initial checkout step
            // Redirect to checkout page with specific error. URL might need to be configurable.
            return Response.redirect(url.origin + '/checkout?error=paypal_missing_order_id', 302);
        }

        // 4. Call Sticky.io order_view
        console.log('PayPal Return Handler: Calling Sticky.io order_view for', { internal_txn_id, stickyOrderId: state.stickyOrderId_Initial });
        // Pass order ID as an array
        const orderViewResponse = await callStickyOrderView([state.stickyOrderId_Initial], env);

        // Check if the order status is 'approved'.
        // NOTE: This check might need refinement based on the exact structure and possible values in the Sticky.io order_view response.
        const isOrderSuccessful = orderViewResponse?.data?.[0]?.order_status === 'approved';

        if (isOrderSuccessful) {
            console.log('PayPal Return Handler: Sticky.io order confirmed successful for', { internal_txn_id, stickyOrderId: state.stickyOrderId_Initial });

            // 5. Trigger Initial Actions (handles idempotency internally)
            // Note: triggerInitialActions should update the state.processed_Initial flag itself
            // Pass internal_txn_id, orderViewResponse as confirmationData, env, ctx, and request
            await triggerInitialActions(internal_txn_id, orderViewResponse, env, ctx, request);

            console.log('PayPal Return Handler: Initial actions triggered for', { internal_txn_id });

            // 6. Redirect to Confirmation Page
            // Redirect to confirmation page. URL structure might need to be configurable.
            return Response.redirect(url.origin + `/confirmation?orderId=${state.stickyOrderId_Initial}`, 302);

        } else {
            // 7. Handle Failure/Pending Status
            const stickyStatus = orderViewResponse?.data?.[0]?.order_status || 'unknown';
            console.log('PayPal Return Handler: Sticky.io order not successful (or status unknown)', { internal_txn_id, stickyOrderId: state.stickyOrderId_Initial, stickyStatus });

            // Update KV state asynchronously
            const updatedState: PixelState = {
                ...state,
                // Use a more specific status if possible based on stickyStatus
                // Use valid status types from PixelState
                status: stickyStatus === 'pending' ? 'pending' : 'failed',
            };
            ctx.waitUntil(
                env.PIXEL_STATE.put(internal_txn_id, JSON.stringify(updatedState))
                    .then(() => console.log('PayPal Return Handler: Updated KV state to failed/pending for', { internal_txn_id }))
                    .catch(err => console.error('PayPal Return Handler: Failed to update KV state', { internal_txn_id, error: err }))
            );

            // 8. Redirect to Error/Pending Page
            // Redirect to checkout page with specific error/status. URL might need to be configurable.
            // Use valid status types for error parameter
            const errorParam = stickyStatus === 'pending' ? 'paypal_pending' : 'paypal_failed'; // Keep user-facing param descriptive
            return Response.redirect(url.origin + `/checkout?error=${errorParam}&orderId=${state.stickyOrderId_Initial}`, 302);
        }

    } catch (error: any) {
        console.error('PayPal Return Handler: Uncaught error', { internal_txn_id, error: error.message, stack: error.stack });
        // Redirect to a generic error page
        // Redirect to a generic error page on checkout. URL might need to be configurable.
        return Response.redirect(url.origin + '/checkout?error=paypal_internal_error', 302);
    }
}