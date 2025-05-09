import { Env } from '../types'; // Assuming types are in ../types
import { STICKY_CONFIG_MAP } from '../config';

/**
 * Generic helper function to call Sticky.io API endpoints.
 * Handles authentication, request construction, basic response parsing, and timeout.
 */
async function callStickyApi(baseUrl: string, endpoint: string, payload: any, env: Env, method: string = 'POST', timeoutMs: number = 10000): Promise<any> { // Added baseUrl parameter, timeout parameter
    const stickyConfigEntry = Object.values(STICKY_CONFIG_MAP).find(config => config.url === baseUrl);

    if (!stickyConfigEntry) {
        console.error(`[StickyLib] No Sticky.io configuration found for baseUrl: ${baseUrl}`);
        throw new Error(`Sticky.io API configuration not found for URL: ${baseUrl}`);
    }

    // Retrieve the username from env using the secret name stored in the map
    const stickyApiUser = env[stickyConfigEntry.username_secret_name] as string | undefined;
    // Retrieve the password from env using the secret name stored in the map
    const stickyApiPass = env[stickyConfigEntry.password_secret_name] as string | undefined;

    if (!stickyApiUser) {
        console.error(`[StickyLib] Sticky.io username not found in environment using secret name '${stickyConfigEntry.username_secret_name}' for ${baseUrl}.`);
        throw new Error(`Sticky.io API username missing or not found in environment (expected secret: ${stickyConfigEntry.username_secret_name})`);
    }
    if (!stickyApiPass) {
        console.error(`[StickyLib] Sticky.io password not found in environment using secret name '${stickyConfigEntry.password_secret_name}' for ${baseUrl}.`);
        throw new Error(`Sticky.io API password missing or not found in environment (expected secret: ${stickyConfigEntry.password_secret_name})`);
    }
    if (!baseUrl) {
        console.error('[StickyLib] Sticky.io base URL missing.');
        throw new Error('Sticky.io base URL missing');
    }

    const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    const stickyUrl = `${cleanBaseUrl}/${cleanEndpoint}`;

    console.log(`[StickyLib] Calling Sticky.io ${method}: ${stickyUrl} with timeout ${timeoutMs}ms`);

    // --- Timeout Logic ---
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        console.warn(`[StickyLib] Aborting fetch to ${endpoint} due to timeout (${timeoutMs}ms)`);
        controller.abort();
    }, timeoutMs);
    // --- End Timeout Logic ---

    let response: Response | null = null;
    let responseBodyText: string = '';

    const isAlternativePaymentNewOrder = endpoint === 'new_order' &&
                                   (payload?.creditCardType === 'paypal' || (typeof payload?.alt_pay_token === 'string' && payload.alt_pay_token.length > 0));

    if (isAlternativePaymentNewOrder) {
        console.log(`[StickyLib] Alternative payment new_order detected for endpoint: ${endpoint}. Modifying headers and response handling.`);
    }

    try {
        const headersInit: HeadersInit = {
            'Authorization': 'Basic ' + btoa(`${stickyApiUser}:${stickyApiPass}`),
        };

        if (method === 'POST' || method === 'PUT') {
            headersInit['Content-Type'] = 'application/json';
        }

        // If not an alternative payment new_order, we expect a JSON response and set Accept header.
        // For alternative payment new_order, we omit 'Accept' to receive HTML from Sticky.io.
        if (!isAlternativePaymentNewOrder && (method === 'POST' || method === 'PUT' || method === 'GET')) {
            headersInit['Accept'] = 'application/json';
        }

        response = await fetch(stickyUrl, {
            method: method,
            headers: headersInit,
            body: JSON.stringify(payload),
            signal: controller.signal // Pass the abort signal
        });

        // Clear timeout if fetch completes
        clearTimeout(timeoutId);

        responseBodyText = await response.text();
        console.log(`[StickyLib] Response Status from ${endpoint}:`, response.status);
        // console.log(`[StickyLib] Raw Response Body from ${endpoint} (isAlternativePaymentNewOrder: ${isAlternativePaymentNewOrder}):`, responseBodyText.substring(0,1000)); // For debugging

        if (isAlternativePaymentNewOrder) {
            console.log(`[StickyLib] Handling response for alternative payment on ${endpoint}.`);

            // First, try to parse as JSON to catch potential API errors from Sticky.io
            try {
                const potentialJsonError = JSON.parse(responseBodyText);
                // Check for common Sticky.io error indicators
                if (potentialJsonError && (potentialJsonError.error_found === "1" || potentialJsonError.status === "ERROR" || (potentialJsonError.response_code && Number(potentialJsonError.response_code) > 1))) {
                    console.warn(`[StickyLib] Received JSON error from ${endpoint} during alternative payment flow. Body sample:`, responseBodyText.substring(0,500));
                    potentialJsonError._status = response.status;
                    // If Sticky returns a 200 status but the payload indicates an error, set _ok to false.
                    potentialJsonError._ok = response.ok && !(potentialJsonError.error_found === "1" || potentialJsonError.status === "ERROR");
                    return potentialJsonError;
                }
            } catch (e) {
                // Not JSON, or malformed JSON. Proceed to HTML check.
                // console.log(`[StickyLib] Response for alternative payment on ${endpoint} is not a JSON error, proceeding to check for HTML redirect.`);
            }

            // For alternative payment new_order, expect HTML and try to extract redirect URL
            // Example: window.location.replace('https://www.sandbox.paypal.com/checkoutnow?token=...');
            const redirectUrlRegex = /window\.location\.replace\s*\(\s*['"]([^'"]+)['"]\s*\)/;
            const match = responseBodyText.match(redirectUrlRegex);

            if (match && match[1]) {
                const extractedUrl = match[1];
                console.log(`[StickyLib] Extracted PayPal redirect URL: ${extractedUrl}`);
                return {
                    _status: response.status,
                    _ok: response.ok, // If redirect is found and status is 2xx, it's OK.
                    gateway_response: { redirect_url: extractedUrl }
                };
            } else {
                // This means it wasn't a JSON error handled above, and it's not HTML with a redirect.
                console.error(`[StickyLib] Failed to extract redirect URL from HTML, or response was not expected format from ${endpoint}. Body sample:`, responseBodyText.substring(0, 500));
                return {
                    _status: response.status,
                    _ok: false, // If we expected a redirect and didn't get one (or got an unhandled format), it's not 'ok'.
                    _rawBody: responseBodyText,
                    error_message: `Failed to extract redirect URL or unexpected response format. Raw sample: ${responseBodyText.substring(0, 200)}...`
                };
            }
        } else {
            // Existing logic for standard JSON API calls
            // console.log(`[StickyLib] Handling standard JSON response for ${endpoint}.`);
            try {
                const responseJson = JSON.parse(responseBodyText);
                responseJson._status = response.status;
                responseJson._ok = response.ok;
                return responseJson;
            } catch (parseError) {
                console.error(`[StickyLib] Failed to parse Sticky.io response JSON from ${endpoint}:`, responseBodyText, parseError);
                return {
                    _status: response.status,
                    _ok: response.ok,
                    _rawBody: responseBodyText,
                    error_message: `Failed to parse response: ${responseBodyText.substring(0, 100)}...`
                };
            }
        }

    } catch (error: any) {
        // Clear timeout if fetch fails for other reasons
        clearTimeout(timeoutId);

        if (error.name === 'AbortError') {
            console.error(`[StickyLib] Fetch to ${endpoint} timed out after ${timeoutMs}ms.`);
            // Return a specific error structure for timeouts
            return {
                _status: 408, // Request Timeout
                _ok: false,
                _rawBody: `Request timed out after ${timeoutMs}ms`,
                error_message: `Request timed out after ${timeoutMs}ms`
            };
        } else {
            console.error(`[StickyLib] Fetch error calling ${endpoint}:`, error);
            // Return a generic error structure for other fetch errors
             return {
                _status: 500, // Or appropriate status based on error? Maybe 502 Bad Gateway?
                _ok: false,
                _rawBody: `Fetch error: ${error.message}`,
                error_message: `Fetch error: ${error.message}`
            };
        }
    }
}

/**
 * Calls the Sticky.io 'new_order' endpoint.
 */
export async function callStickyNewOrder(baseUrl: string, payload: any, env: Env): Promise<any> {
    return callStickyApi(baseUrl, 'new_order', payload, env, 'POST');
}

/**
 * Calls the Sticky.io 'new_upsell' endpoint.
 */
export async function callStickyUpsell(baseUrl: string, payload: any, env: Env, gatewayId?: string | number): Promise<any> {
    const finalPayload = { ...payload };
    if (gatewayId !== undefined) {
        finalPayload.gatewayId = gatewayId; // Correctly map to gatewayId for the API call
    }
    return callStickyApi(baseUrl, 'new_upsell', finalPayload, env, 'POST');
}

/**
 * Calls the Sticky.io 'order_view' endpoint.
 */
export async function callStickyOrderView(baseUrl: string, orderIds: string[], env: Env): Promise<any> {
    console.log('[StickyLib] Preparing order_view request for order IDs:', orderIds);
    const payload = { order_id: orderIds };
    console.log('[StickyLib] order_view payload:', JSON.stringify(payload));
    // Using default 10-second timeout for order_view
    const result = await callStickyApi(baseUrl, 'order_view', payload, env, 'POST');
    console.log('[StickyLib] order_view result:', JSON.stringify(result));
    return result;
}