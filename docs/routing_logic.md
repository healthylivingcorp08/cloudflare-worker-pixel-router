# Cloudflare Worker Routing Logic (`src/index.ts`)

This document explains how the Cloudflare Worker defined in `src/index.ts` routes incoming HTTP requests.

## Entry Point: `fetch` Handler

The primary entry point is the `async fetch(request: Request, env: Env)` function exported as the default module. It receives the incoming `request` and the environment `env` (containing bindings like KV namespaces and secrets).

## Request Handling Flow

1.  **URL Parsing:** The request URL is parsed to get the `pathname`.
2.  **CORS Preflight (`OPTIONS`):**
    *   If the request method is `OPTIONS` and the `pathname` matches specific API routes (`/api/checkout`, `/api/checkout-rules`, `/api/page-pixels`, `/api/order-details`), it calls `handleOptions` to respond with appropriate CORS headers (`Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, etc.) based on the `allowedOrigins` list.
3.  **Admin Routes (`/admin*`):**
    *   **Public Admin Paths:** Requests to `/admin`, `/admin/`, `/admin/login`, and `/admin/api/auth/login` are directly passed to `handleAdminRequest` (defined in `src/admin/router.ts`).
    *   **Protected Admin API Paths:** Requests starting with `/admin/api/` (excluding `/admin/api/auth/login`) first go through `authenticateRequest` (from `src/admin/middleware/auth.ts`).
        *   If authentication fails or requires a redirect, the response from `authenticateRequest` is returned immediately.
        *   If authentication succeeds, the (potentially modified) request is passed to `handleAdminRequest`.
    *   **Static Admin Assets:** Other paths under `/admin/` (like `/admin/ui/admin.css`) are implicitly handled by Wrangler's static asset serving mechanism, as they are not explicitly caught by the routing logic.
4.  **API Routes (`/api/*`):**
    *   **`POST /api/checkout-rules`:**
        *   Handles requests to determine which checkout actions (pixels/postbacks) should be executed based on site-specific rules (scrub percentage, campaign ID) stored in the `PIXEL_CONFIG` KV namespace.
        *   Performs a random check against the scrub percentage.
        *   Checks for campaign-specific rules that might override or append actions.
        *   Fetches the relevant action definitions (e.g., Facebook Purchase pixel details) from KV based on the decision (scrub/normal/campaign).
        *   Returns a JSON response containing the `decision` ('scrub' or 'normal') and an array of `actionsToExecute` (the full action definitions). CORS headers are added via `addCorsHeaders`.
    *   **`POST /api/order-details`:**
        *   Acts as a secure proxy to fetch order details from the Sticky.io API (`POST /order_view`).
        *   Expects an `orderId` in the JSON request body.
        *   Uses `STICKY_USERNAME` and `STICKY_PASSWORD` secrets for authentication.
        *   Calls the Sticky.io API.
        *   Maps the Sticky.io response to the `OrderConfirmation` interface expected by the frontend.
        *   Returns the mapped order details as JSON. CORS headers are added.
    *   **`POST /api/page-pixels`:**
        *   Determines which pixels/actions should be fired for general page views (not checkout).
        *   Expects `siteId`, `url` (the frontend page URL), and potentially tracking parameters (`affid`, `c1`, `campid`, `ef_transaction_id`) in the JSON body.
        *   Fetches page rules (`{siteId}_rule_pageRules`) from KV to determine the `pageType` based on the provided `url`.
        *   Fetches affiliate rules (`{siteId}_rule_{pageType}AffIdRules`) from KV based on the determined `pageType`.
        *   Finds actions associated with the specific `affid` provided in the request (if any).
        *   Fetches the full action definitions from KV based on the matched rules.
        *   Performs parameter replacement within the action definitions (e.g., replacing `PARAM:c1` with the value of `c1` from the request body).
        *   Returns a JSON response containing an array of `actionsToExecute`. CORS headers are added.
5.  **Root Checkout (`POST /`):**
    *   Handles the main checkout form submission from the frontend's API route.
    *   Expects checkout data (customer info, payment, offers, analytics) in the JSON body, including `siteId`.
    *   Calls the Sticky.io New Order API (`POST /new_order`) using credentials from secrets.
    *   **If Sticky.io call succeeds:**
        *   Extracts the `order_id`.
        *   Determines checkout actions based on scrub/normal/campaign rules (similar logic to `/api/checkout-rules`).
        *   Fetches and processes action definitions, performing parameter replacement using data from the request and the Sticky.io response.
        *   **Crucially, this endpoint does *not* fire the pixels itself.** It returns a JSON response `{ success: true, orderId: ... }` to the calling Next.js API route. The Next.js route is then responsible for initiating the redirect to the upsell page.
    *   **If Sticky.io call fails:** Returns an error response.
    *   CORS headers are added to the success/error JSON response.
6.  **Fallback (404 Not Found):**
    *   If the request `pathname` and `method` do not match any of the above routes, a `404 Not Found` response is returned.

## Helper Functions

*   `isAdminPublicPath(pathname)`: Checks if a given admin path is public (login page/API).
*   `handleOptions(request)`: Generates CORS preflight responses.
*   `addCorsHeaders(response, request)`: Adds the `Access-Control-Allow-Origin` header to outgoing responses if the request origin is allowed.