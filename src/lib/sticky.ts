import { Env } from '../types'; // Assuming types are in ../types

/**
 * Generic helper function to call Sticky.io API endpoints.
 * Handles authentication, request construction, basic response parsing, and timeout.
 */
async function callStickyApi(endpoint: string, payload: any, env: Env, method: string = 'POST', timeoutMs: number = 10000): Promise<any> { // Added timeout parameter
    const stickyBaseUrl = "https://techcommerceunlimited.sticky.io/api/v1"; // Hardcoded API URL
    const stickyApiUser = env.STICKY_USERNAME;
    const stickyApiPass = env.STICKY_PASSWORD;

    if (!stickyApiUser || !stickyApiPass) {
        console.error('[StickyLib] Sticky.io credentials missing in environment secrets.');
        throw new Error('Sticky.io API credentials missing');
    }

    const cleanBaseUrl = stickyBaseUrl.endsWith('/') ? stickyBaseUrl.slice(0, -1) : stickyBaseUrl;
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

    try {
        response = await fetch(stickyUrl, {
            method: method,
            headers: {
                'Authorization': 'Basic ' + btoa(`${stickyApiUser}:${stickyApiPass}`),
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload),
            signal: controller.signal // Pass the abort signal
        });

        // Clear timeout if fetch completes
        clearTimeout(timeoutId);

        responseBodyText = await response.text();
        console.log(`[StickyLib] Response Status from ${endpoint}:`, response.status);

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
export async function callStickyNewOrder(payload: any, env: Env): Promise<any> {
    return callStickyApi('new_order', payload, env, 'POST');
}

/**
 * Calls the Sticky.io 'new_upsell' endpoint.
 */
export async function callStickyUpsell(payload: any, env: Env): Promise<any> {
    return callStickyApi('new_upsell', payload, env, 'POST');
}

/**
 * Calls the Sticky.io 'order_view' endpoint.
 */
export async function callStickyOrderView(orderIds: string[], env: Env): Promise<any> {
    console.log('[StickyLib] Preparing order_view request for order IDs:', orderIds);
    const payload = { order_id: orderIds };
    console.log('[StickyLib] order_view payload:', JSON.stringify(payload));
    // Using default 10-second timeout for order_view
    const result = await callStickyApi('order_view', payload, env, 'POST');
    console.log('[StickyLib] order_view result:', JSON.stringify(result));
    return result;
}