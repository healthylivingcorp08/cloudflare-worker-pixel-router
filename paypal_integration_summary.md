# PayPal Integration Summary for Sticky.io

This document summarizes the changes made to `src/lib/sticky.ts` and `src/handlers/checkout.ts` to address PayPal integration issues with Sticky.io.

## 1. Initial Problem

*   **JSON Parsing Error:** Sticky.io was returning an HTML page for PayPal `new_order` API requests, while the Cloudflare worker was expecting a JSON response. This mismatch caused JSON parsing errors.
*   **Incorrect Return URL:** The `alt_pay_return_url` parameter sent to Sticky.io was using the worker's URL (e.g., `https://worker.example.com`) instead of the actual e-commerce site's URL (e.g., `https://www.actualsite.com`), leading to users being redirected incorrectly after PayPal payment.

## 2. Changes to `src/lib/sticky.ts` (within `callStickyApi` function)

The `callStickyApi` function was modified to handle PayPal `new_order` requests differently:

*   **PayPal Request Detection:**
    *   Logic was added to identify if a `new_order` request is specifically for PayPal by checking `payload.creditCardType === 'paypal'`.

*   **Header Management for PayPal `new_order` Requests:**
    *   **Initial Attempt:** Both `Content-Type: application/json` and `Accept: application/json` headers were removed. This resulted in an error from Sticky.io: "Invalid JSON format or missing required JSON body".
    *   **Revised Approach:**
        *   `Content-Type: application/json` **IS SENT**: This is necessary for Sticky.io to correctly parse the JSON payload of the `new_order` request.
        *   `Accept: application/json` **IS OMITTED**: This encourages Sticky.io to return the HTML redirect page (which contains the PayPal redirect URL) instead of attempting to send a JSON response.
        *   The `Authorization` header is always included for authentication.

*   **Response Handling for PayPal `new_order` Requests:**
    *   The function now expects an HTML response body from Sticky.io for PayPal `new_order` calls.
    *   It parses this `responseBodyText` using a regular expression (`/window\.location\.replace\('(.*?)'\);/`) to extract the PayPal redirect URL from a JavaScript snippet embedded in the HTML (e.g., `window.location.replace('URL_HERE');`).
    *   On successful extraction, it returns an object structured as `{ gateway_response: { redirect_url: extractedUrl } }`.

*   **Non-PayPal Requests:**
    *   For all other API requests (non-PayPal or not `new_order`), the existing logic of sending both `Content-Type: application/json` and `Accept: application/json` headers, and parsing the JSON response, is maintained.

## 3. Changes to `src/handlers/checkout.ts` (within `handleCheckout` function)

The `handleCheckout` function was updated to correctly construct the `alt_pay_return_url` for PayPal payments:

*   **`alt_pay_return_url` Construction for PayPal:**
    *   **Initial Approach:** The system attempted to fetch a `site_base_url` from a KV store to build the return URL.
    *   **Revised Approach (based on feedback):** The function now expects a `siteBaseUrl` field to be present in the JSON payload of the incoming request from the frontend.
    *   This `siteBaseUrl` (e.g., "https://www.actualsite.com") is used as the base for the `alt_pay_return_url`.
    *   The path for the return URL remains `/upsell1` (or as configured).
    *   Original query parameters from the incoming request are appended to this constructed URL.
    *   **Fallback:** If `siteBaseUrl` is not provided in the request payload, the system defaults to using `originalUrl.origin` (the worker's own origin) and logs an error, ensuring a redirect still occurs, albeit potentially to a less ideal location.

## 4. Overall Goal of Changes

The primary objectives of these modifications were:

*   To correctly integrate the HTML-based redirect flow required for PayPal payments processed through Sticky.io.
*   To ensure that the `alt_pay_return_url` directs users back to the appropriate page on the actual e-commerce site after completing their PayPal transaction.
*   To make the PayPal integration more robust by adapting to Sticky.io's specific API behavior concerning request headers and response types for PayPal transactions.