import { Env } from '../types'; // Assuming types are in ../types

/**
 * Generic helper function to call Sticky.io API endpoints.
 * Handles authentication, request construction, and basic response parsing.
 */
async function callStickyApi(endpoint: string, payload: any, env: Env, method: string = 'POST'): Promise<any> {
    const stickyBaseUrl = "https://techcommerceunlimited.sticky.io/api/v1"; // Hardcoded API URL
    const stickyApiUser = env.STICKY_USERNAME;
    const stickyApiPass = env.STICKY_PASSWORD;

    // Check only for username and password now, as URL is hardcoded
    if (!stickyApiUser || !stickyApiPass) {
        console.error('[StickyLib] Sticky.io credentials missing in environment secrets.');
        throw new Error('Sticky.io API credentials missing'); // Updated error message
    }

    // Ensure the base URL doesn't end with a slash and the endpoint doesn't start with one
    const cleanBaseUrl = stickyBaseUrl.endsWith('/') ? stickyBaseUrl.slice(0, -1) : stickyBaseUrl;
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    // Construct full URL by joining base and specific endpoint
    const stickyUrl = `${cleanBaseUrl}/${cleanEndpoint}`;
   
    console.log(`[StickyLib] Calling Sticky.io ${method}: ${stickyUrl}`);
    // Avoid logging sensitive payload details in production environments
    // console.log(`[StickyLib] Payload: ${JSON.stringify(payload)}`);

    const response = await fetch(stickyUrl, {
        method: method,
        headers: {
            'Authorization': 'Basic ' + btoa(`${stickyApiUser}:${stickyApiPass}`),
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    const responseBodyText = await response.text();
    console.log(`[StickyLib] Response Status from ${endpoint}:`, response.status);
    // Avoid logging full body in production if it might contain sensitive info returned on error
    // console.log(`[StickyLib] Response Body Text:`, responseBodyText);

    try {
        const responseJson = JSON.parse(responseBodyText);
        // Add status and ok flags for easier checking in handlers
        responseJson._status = response.status;
        responseJson._ok = response.ok;
        return responseJson;
    } catch (e) {
        console.error(`[StickyLib] Failed to parse Sticky.io response JSON from ${endpoint}:`, responseBodyText);
        // Return a structured error object consistent with the original function
        return {
            _status: response.status,
            _ok: response.ok,
            _rawBody: responseBodyText,
            error_message: `Failed to parse response: ${responseBodyText.substring(0, 100)}...` // Truncate
        };
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
 * @param orderIds Array of order IDs to view.
 */
export async function callStickyOrderView(orderIds: string[], env: Env): Promise<any> {
    const payload = { order_id: orderIds };
    return callStickyApi('order_view', payload, env, 'POST');
}