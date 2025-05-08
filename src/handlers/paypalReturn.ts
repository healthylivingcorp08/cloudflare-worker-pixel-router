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


    // internal_txn_id is already validated to exist at this point
    const kvKey = `txn_${internal_txn_id}`;

    try {
        const stateString = await env.PIXEL_STATE.get(kvKey);
        if (!stateString) {
            console.error('PayPal Return Handler: State not found in KV for key:', kvKey, { internal_txn_id });
            return Response.redirect(url.origin + `/checkout?error=paypal_invalid_session&internal_txn_id=${internal_txn_id}`, 302);
        }

        const state: PixelState = JSON.parse(stateString);
        console.log('PayPal Return Handler: Found state for key:', kvKey, { status: state.status, paymentMethod_initial: state.paymentMethod_initial });

        const paypalTransactionId = url.searchParams.get('transactionID');
        const paypalPayerID = url.searchParams.get('PayerID');
        const stickyOrderIdFromPaypalReturn = url.searchParams.get('orderId');
        const gatewayIdFromPaypalReturn = url.searchParams.get('gatewayId');

        // Determine the order ID to use for verification, prioritizing PayPal's return if valid.
        let orderIdForVerification = state.stickyOrderId_initial; // Default to what's in state

        if (stickyOrderIdFromPaypalReturn && typeof stickyOrderIdFromPaypalReturn === 'string' && stickyOrderIdFromPaypalReturn.trim() !== '') {
            console.log(`[PayPalReturnHandler] PayPal return URL provided stickyOrderId: '${stickyOrderIdFromPaypalReturn}'. This will be prioritized for order_view. Current state.stickyOrderId_initial was: '${state.stickyOrderId_initial}'. Key: ${kvKey}`);
            orderIdForVerification = stickyOrderIdFromPaypalReturn;
            // Update state.stickyOrderId_initial for consistency and persistence if it's different or wasn't set.
            if (state.stickyOrderId_initial !== stickyOrderIdFromPaypalReturn) {
                state.stickyOrderId_initial = stickyOrderIdFromPaypalReturn;
                console.log(`[PayPalReturnHandler] Updated state.stickyOrderId_initial to '${state.stickyOrderId_initial}'. Key: ${kvKey}`);
            }
        } else {
            console.log(`[PayPalReturnHandler] No valid stickyOrderId in PayPal return URL, or it matches existing. Using state.stickyOrderId_initial: '${state.stickyOrderId_initial}' for order_view. Key: ${kvKey}`);
        }
        
        // Store/update other PayPal/Sticky parameters in state and persist
        if (paypalTransactionId || paypalPayerID || stickyOrderIdFromPaypalReturn || gatewayIdFromPaypalReturn) {
            console.log('PayPal Return Handler: Storing/Updating PayPal/Sticky parameters in state for key:', kvKey, { paypalTransactionId, paypalPayerID, stickyOrderIdFromPaypalReturn, gatewayIdFromPaypalReturn });
            state.paypalTransactionId = paypalTransactionId || state.paypalTransactionId;
            state.paypalPayerId = paypalPayerID || state.paypalPayerId;
            // Store the raw param for reference, even if not used directly for orderIdForVerification logic above
            state.stickyOrderIdFromPaypalReturn = stickyOrderIdFromPaypalReturn || state.stickyOrderIdFromPaypalReturn;
            state.gatewayIdFromPaypalReturn = gatewayIdFromPaypalReturn || state.gatewayIdFromPaypalReturn;
            // state.stickyOrderId_initial is already updated above by the orderIdForVerification logic

            ctx.waitUntil(
                env.PIXEL_STATE.put(kvKey, JSON.stringify(state))
                    .then(() => console.log(`PayPal Return Handler: Successfully stored/updated PIXEL_STATE for key: ${kvKey}. stickyOrderId_initial is now: ${state.stickyOrderId_initial}`))
                    .catch(err => console.error('PayPal Return Handler: Failed to store/update PIXEL_STATE for key:', kvKey, { error: err.message }))
            );
        } else {
            console.log('PayPal Return Handler: No new PayPal/Sticky parameters found in URL to update state with for key:', kvKey);
        }

        if (state.processedInitial) {
            console.log('PayPal Return Handler: Initial actions already processed for key:', kvKey);
            const frontendBaseForProcessed = state.siteBaseUrl || url.origin;
            const nextStepUrl = new URL(frontendBaseForProcessed);
            nextStepUrl.pathname = state.confirmedStickyOrderId ? '/confirmation' : '/upsell1';
            nextStepUrl.searchParams.set('internal_txn_id', internal_txn_id);
            // Use orderIdForVerification (which is now also in state.stickyOrderId_initial) for the redirect
            if (orderIdForVerification) {
                nextStepUrl.searchParams.set('orderId', orderIdForVerification);
            }
            if (stickyUrlIdFromParam) {
                nextStepUrl.searchParams.set('sticky_url_id', stickyUrlIdFromParam);
            }
            console.log(`[PayPalReturnHandler] Already processed, redirecting to: ${nextStepUrl.toString()} for key: ${kvKey}`);
            return Response.redirect(nextStepUrl.toString(), 302);
        }

        // Critical check for the order ID we will actually use for verification
        if (!orderIdForVerification) {
            console.error('[PayPalReturnHandler] Critical: Missing orderIdForVerification for order_view for key:', kvKey, 'State:', JSON.stringify(state));
            const errorRedirectBase = state.siteBaseUrl || url.origin;
            const errorRedirectUrl = new URL(errorRedirectBase);
            errorRedirectUrl.pathname = '/checkout';
            errorRedirectUrl.searchParams.set('error', 'paypal_missing_order_id_for_verification');
            if (internal_txn_id) errorRedirectUrl.searchParams.set('internal_txn_id', internal_txn_id);
            if (stickyUrlIdFromParam) errorRedirectUrl.searchParams.set('sticky_url_id', stickyUrlIdFromParam);
            return Response.redirect(errorRedirectUrl.toString(), 302);
        }

        console.log('[PayPalReturnHandler] Calling Sticky.io order_view for key:', kvKey, { stickyOrderId: orderIdForVerification });
        let orderViewResponse = await callStickyOrderView(stickyBaseUrl, [orderIdForVerification], env);

        let isOrderSuccessful = false;
        let actualStickyOrderStatus: string | undefined = undefined;

        if (orderViewResponse && orderViewResponse.response_code === '100') {
            actualStickyOrderStatus = orderViewResponse.order_status;
            if (String(actualStickyOrderStatus) === '2') {
                isOrderSuccessful = true;
                console.log(`[PayPalReturnHandler] Initial Sticky.io order_view successful. Status: '${actualStickyOrderStatus}'.`);
            } else {
                console.warn(`[PayPalReturnHandler] Initial order_view for ${state.stickyOrderId_initial} status: '${actualStickyOrderStatus}'. Retrying after 2s delay.`);
                await new Promise(resolve => setTimeout(resolve, 2000)); // 2-second delay

                let retryOrderViewResponse = await callStickyOrderView(stickyBaseUrl, [state.stickyOrderId_initial!], env);
                console.log(`[PayPalReturnHandler] Retry order_view response for ${state.stickyOrderId_initial}:`, JSON.stringify(retryOrderViewResponse).substring(0, 500) + (JSON.stringify(retryOrderViewResponse).length > 500 ? '...' : ''));

                if (retryOrderViewResponse && retryOrderViewResponse.response_code === '100') {
                    actualStickyOrderStatus = retryOrderViewResponse.order_status; // Update with retry status
                    if (String(actualStickyOrderStatus) === '2') {
                        isOrderSuccessful = true;
                        orderViewResponse = retryOrderViewResponse; // Use the successful retry response data
                        console.log(`[PayPalReturnHandler] Retry Sticky.io order_view successful. Status: '${actualStickyOrderStatus}'.`);
                    } else {
                        console.warn(`[PayPalReturnHandler] Retry Sticky.io order_view still not approved. Status: '${actualStickyOrderStatus}'.`);
                    }
                } else {
                    console.warn(`[PayPalReturnHandler] Retry Sticky.io order_view API call failed or malformed. Response:`, JSON.stringify(retryOrderViewResponse).substring(0, 500) + (JSON.stringify(retryOrderViewResponse).length > 500 ? '...' : ''));
                }
            }
        } else {
            // Initial API call itself failed or returned an error response_code or was malformed
            console.warn(`[PayPalReturnHandler] Initial Sticky.io order_view API call did not return response_code 100 or was malformed. Response:`, JSON.stringify(orderViewResponse).substring(0, 500) + (JSON.stringify(orderViewResponse).length > 500 ? '...' : ''));
            actualStickyOrderStatus = orderViewResponse?.order_status || 'unknown_api_error';
            // isOrderSuccessful remains false
        }

        // Detailed logging for the orderViewResponse if not successful
        if (!isOrderSuccessful) {
            console.warn('[PayPalReturnHandler] Order NOT successful based on order_view response. Full orderViewResponse:', JSON.stringify(orderViewResponse, null, 2));
            // The logs for orderViewResponse.data will show 'undefined' as it's a flat structure, which is now understood.
        }

        if (isOrderSuccessful) {
            console.log('[PayPalReturnHandler] Sticky.io order confirmed successful for key:', kvKey, { stickyOrderId: state.stickyOrderId_initial });

            // Extract confirmedStickyOrderId from the flat orderViewResponse
            const confirmedStickyOrderIdFromView = orderViewResponse.order_id;
            if (confirmedStickyOrderIdFromView) {
                state.confirmedStickyOrderId = String(confirmedStickyOrderIdFromView); // Ensure it's a string
                console.log('[PayPalReturnHandler] Extracted confirmedStickyOrderId from order_view response for key:', kvKey, { confirmedStickyOrderId: state.confirmedStickyOrderId });
            } else {
                console.warn('[PayPalReturnHandler] Could not extract confirmed_order_id from successful Sticky.io order_view response (response_code 100) for key:', kvKey, { orderViewResponse });
            }

            // Store customer details from orderViewResponse into state for upsells
            state.customerFirstName = orderViewResponse.billing_first_name;
            state.customerLastName = orderViewResponse.billing_last_name;
            state.customerEmail = orderViewResponse.email_address;
            state.customerPhone = orderViewResponse.customers_telephone; // Added phone

            state.customerAddress = {
                street: orderViewResponse.billing_street_address,
                street2: orderViewResponse.billing_street_address2,
                city: orderViewResponse.billing_city,
                state: orderViewResponse.billing_state,
                zip: orderViewResponse.billing_postcode,
                country: orderViewResponse.billing_country,
            };
            // Assuming shipping is same as billing from initial PayPal order for now,
            // or that Sticky.io new_upsell might not need full shipping if it's based on previousOrderId
            state.customerShippingAddress = {
                street: orderViewResponse.shipping_street_address,
                street2: orderViewResponse.shipping_street_address2,
                city: orderViewResponse.shipping_city,
                state: orderViewResponse.shipping_state,
                zip: orderViewResponse.shipping_postcode,
                country: orderViewResponse.shipping_country,
            };
            // Note: orderViewResponse.shipping_first_name and shipping_last_name are available
            // if they need to be stored separately in PixelState (e.g., as customerShippingFirstName).
            // For now, customerFirstName/LastName (from billing) will be used by upsell handler.
            
            // Ensure gatewayId from the successful order_view is stored if not already from paypal return
            if (orderViewResponse.gateway_id && !state.gatewayIdFromPaypalReturn) {
                 state.gatewayId = String(orderViewResponse.gateway_id); // Store the gateway ID from the confirmed order
                 console.log(`[PayPalReturnHandler] Stored gatewayId ${state.gatewayId} from order_view for key: ${kvKey}`);
            } else if (state.gatewayIdFromPaypalReturn) {
                state.gatewayId = state.gatewayIdFromPaypalReturn; // Prefer the one from PayPal return if available
                 console.log(`[PayPalReturnHandler] Using gatewayId ${state.gatewayId} from PayPal return params for key: ${kvKey}`);
            }


            // Persist state with customer details BEFORE calling triggerInitialActions,
            // as triggerInitialActions itself will save the state again.
            // This ensures customer details are available if triggerInitialActions needs them or for subsequent upsell.
            await env.PIXEL_STATE.put(kvKey, JSON.stringify(state));
            console.log('[PayPalReturnHandler] Updated PIXEL_STATE with customer details from order_view before triggering actions for key:', kvKey);


            // Pass internal_txn_id (raw) to triggerInitialActions, as it will construct its own kvKey internally
            // Pass the raw orderViewResponse as it contains all order details needed by actions
            await triggerInitialActions(internal_txn_id, orderViewResponse, env, ctx, request);
            
            // After actions, state in KV is updated by triggerInitialActions. Re-fetch for redirect using kvKey.
            // This re-fetch is important because triggerInitialActions modifies and saves the state.
            const finalStateString = await env.PIXEL_STATE.get(kvKey);
            const finalState: PixelState = finalStateString ? JSON.parse(finalStateString) : state; // Use in-memory state as fallback

            console.log('[PayPalReturnHandler] Initial actions triggered for key:', kvKey);

            // Determine redirect: Upsell 1 or Confirmation, using frontend base URL
            const frontendBaseUrl = finalState.siteBaseUrl || state.siteBaseUrl;
            if (!frontendBaseUrl) {
                console.error(`[PayPalReturnHandler] siteBaseUrl not found in state for key: ${kvKey}. Cannot redirect to frontend upsell page.`);
                const fallbackErrorUrl = new URL(url.origin); // Worker's origin
                fallbackErrorUrl.pathname = '/checkout';
                fallbackErrorUrl.searchParams.set('error', 'paypal_config_missing_sitebaseurl');
                if (internal_txn_id) fallbackErrorUrl.searchParams.set('internal_txn_id', internal_txn_id);
                return Response.redirect(fallbackErrorUrl.toString(), 302);
            }

            const redirectUrl = new URL(frontendBaseUrl); // Use the frontend's base URL from state
            redirectUrl.pathname = '/upsell1'; // Path on the frontend
            redirectUrl.searchParams.set('internal_txn_id', internal_txn_id);
            // internal_txn_id is already set prior to this block
            // orderId (from initial order)
            if (finalState.stickyOrderId_initial) {
                redirectUrl.searchParams.set('orderId', finalState.stickyOrderId_initial);
            }

            // gatewayId
            if (finalState.gatewayId) {
                redirectUrl.searchParams.set('gatewayId', String(finalState.gatewayId));
            }

            // Check if orderViewResponse exists before trying to access its properties
            if (orderViewResponse) {
                // shippingId
                if (orderViewResponse.shipping_id) {
                    redirectUrl.searchParams.set('shippingId', String(orderViewResponse.shipping_id));
                }

                // ipAddress
                if (orderViewResponse.ip_address) {
                    redirectUrl.searchParams.set('ipAddress', orderViewResponse.ip_address);
                }

                // campaignId (from the initial order)
                if (orderViewResponse.campaign_id) {
                    redirectUrl.searchParams.set('campaignId', String(orderViewResponse.campaign_id));
                }

                // shippingCountry (for frontend's shippingInfo.country)
                if (orderViewResponse.shipping_country) {
                    redirectUrl.searchParams.set('shippingCountry', orderViewResponse.shipping_country);
                }

                // Tracking parameters
                if (orderViewResponse.afid) {
                     redirectUrl.searchParams.set('AFID', orderViewResponse.afid);
                } else if (orderViewResponse.affiliate) { // Fallback for AFID
                    redirectUrl.searchParams.set('AFID', orderViewResponse.affiliate);
                }
                if (orderViewResponse.sid) redirectUrl.searchParams.set('SID', orderViewResponse.sid);
                if (orderViewResponse.affid) redirectUrl.searchParams.set('AFFID', orderViewResponse.affid); // Specific 'affid'
                if (orderViewResponse.c1) redirectUrl.searchParams.set('C1', orderViewResponse.c1);
                if (orderViewResponse.c2) redirectUrl.searchParams.set('C2', orderViewResponse.c2);
                if (orderViewResponse.c3) redirectUrl.searchParams.set('C3', orderViewResponse.c3);
                if (orderViewResponse.click_id) redirectUrl.searchParams.set('click_id', orderViewResponse.click_id);
            }
            
            // sticky_url_id (persisted from original request)
            if (stickyUrlIdFromParam) {
                redirectUrl.searchParams.set('sticky_url_id', stickyUrlIdFromParam);
            }

            console.log(`[PayPalReturnHandler] Redirecting to Frontend Upsell 1: ${redirectUrl.toString()} for key: ${kvKey}`);
            return Response.redirect(redirectUrl.toString(), 302);

        } else {
            // Order not successful path
            // Use actualStickyOrderStatus determined earlier. It could be an API error string or a numeric status.
            const finalStickyStatus = actualStickyOrderStatus || 'unknown';
            console.log('[PayPalReturnHandler] Sticky.io order not successful. Status from order_view:', finalStickyStatus, 'for key:', kvKey, { stickyOrderId: state.stickyOrderId_initial });

            // Sticky.io order_status '1' is 'Pending'. Other numeric statuses are various forms of non-approved.
            const isPending = finalStickyStatus === '1';
            const stateStatus = isPending ? 'pending' : 'failed';
            const errorParam = isPending ? 'paypal_pending' : 'paypal_failed';

            const updatedState: PixelState = { ...state, status: stateStatus };
            ctx.waitUntil(
                env.PIXEL_STATE.put(kvKey, JSON.stringify(updatedState))
                    .then(() => console.log(`[PayPalReturnHandler] Updated KV state to ${stateStatus} for key:`, kvKey))
                    .catch(err => console.error('[PayPalReturnHandler] Failed to update KV state for key:', kvKey, { error: err.message }))
            );
            
            const frontendErrorRedirectBase = state.siteBaseUrl || url.origin; // Best effort for base URL
            const errorRedirectUrl = new URL(frontendErrorRedirectBase);
            errorRedirectUrl.pathname = '/checkout'; // User can change this if they want errors on /upsell1
            errorRedirectUrl.searchParams.set('error', errorParam);
            if (internal_txn_id) errorRedirectUrl.searchParams.set('internal_txn_id', internal_txn_id);
            if (state.stickyOrderId_initial) errorRedirectUrl.searchParams.set('orderId', state.stickyOrderId_initial);
            if (stickyUrlIdFromParam) errorRedirectUrl.searchParams.set('sticky_url_id', stickyUrlIdFromParam);
            
            console.log(`[PayPalReturnHandler] Order not successful, redirecting to frontend checkout with error: ${errorRedirectUrl.toString()}`);
            return Response.redirect(errorRedirectUrl.toString(), 302);
        }

    } catch (error: any) {
        console.error('PayPal Return Handler: Uncaught error', { internal_txn_id, error: error.message, stack: error.stack });
        
        // Attempt to retrieve state to get siteBaseUrl for a more graceful error redirect
        let frontendGenericErrorBase = url.origin; // Default to worker origin
        if (internal_txn_id) {
            try {
                const stateStringForError = await env.PIXEL_STATE.get(kvKey); // Use kvKey
                if (stateStringForError) {
                    const stateForError: PixelState = JSON.parse(stateStringForError);
                    if (stateForError.siteBaseUrl) {
                        frontendGenericErrorBase = stateForError.siteBaseUrl;
                    }
                }
            } catch (e) {
                console.error('[PayPalReturnHandler] Could not fetch state during catch block:', e);
            }
        }

        const genericErrorUrl = new URL(frontendGenericErrorBase);
        genericErrorUrl.pathname = '/checkout'; // Or a more specific error page like /error
        genericErrorUrl.searchParams.set('error', 'paypal_internal_error');
        if (internal_txn_id) genericErrorUrl.searchParams.set('internal_txn_id', internal_txn_id);
        if (stickyUrlIdFromParam) genericErrorUrl.searchParams.set('sticky_url_id', stickyUrlIdFromParam);
        
        return Response.redirect(genericErrorUrl.toString(), 302);
    }
}