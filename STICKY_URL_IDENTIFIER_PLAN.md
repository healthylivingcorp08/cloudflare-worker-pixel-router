# Plan: Sticky.io URL Handling via Identifier Mapping

This plan outlines how to manage different Sticky.io base URLs for various sites served by a single Cloudflare worker, ensuring the URLs are not exposed client-side and minimizing worker updates when adding new sites.

## Core Idea

Instead of passing the full `stickyBaseUrl` from the client or using complex proxy logic, the client will pass a simple identifier (e.g., '1', '2', 'drivebright_default'). The Cloudflare worker will maintain an internal mapping of these identifiers to the actual `stickyBaseUrl` strings and use the identifier sent by the client to look up the correct URL.

## Implementation Steps

1.  **Worker: Define URL Mapping (`src/config.ts` or similar)** [DONE]
    *   Create a constant object mapping identifiers to full URLs.
    *   Example:
        ```typescript
        export const STICKY_URL_MAP: Record<string, string> = {
          '1': 'https://techcommerceunlimited.sticky.io/api/v1', // drivebright
          '2': 'URL_FOR_SITE_B', // Replace with actual URL
          // Add other identifiers and URLs as needed
        };
        ```

2.  **Monorepo Site Configuration (`sites/<site-name>/src/config/siteConstants.ts`)** [DONE]
    *   Each site defines its unique `SITE_ID` and the appropriate `STICKY_URL_IDENTIFIER` corresponding to the map in the worker.
    *   Example for `drivebright`:
        ```typescript
        export const SITE_ID = 'drivebright';
        export const STICKY_URL_IDENTIFIER = '1';
        ```

3.  **Client-Side Code (Next.js - e.g., in API utility or `CheckoutForm`)** [DONE]
    *   Import `SITE_ID` and `STICKY_URL_IDENTIFIER` from the site's local configuration (`@/config/siteConstants.ts`).
    *   When making API calls **directly to the Cloudflare worker**:
        *   Include the `SITE_ID` in the `X-Site-ID` header.
        *   Include the `STICKY_URL_IDENTIFIER` in the `X-Sticky-Url-Id` header.
        *   For upsell requests, also include the `gateway_id` received from the initial checkout response (e.g., in `X-Gateway-ID` header or request body).

4.  **Cloudflare Worker Handlers (`src/handlers/checkout.ts`, `src/handlers/upsell.ts`, etc.)** [DONE]
    *   Read the `X-Site-ID` header to identify the site for any specific logic (e.g., KV lookups).
    *   Read the `X-Sticky-Url-Id` header.
    *   Import `STICKY_URL_MAP` from `src/config.ts`.
    *   Look up the `stickyBaseUrl` from the map using the received identifier. Handle cases where the identifier is missing or invalid (e.g., return 400 error or use a default URL).
        ```typescript
        import { STICKY_URL_MAP } from '../config';
        // ... inside handler ...
        const urlIdentifier = request.headers.get('X-Sticky-Url-Id');
        const stickyBaseUrl = urlIdentifier ? STICKY_URL_MAP[urlIdentifier] : null;

        if (!stickyBaseUrl) {
          // Handle error - invalid or missing identifier
          return new Response('Invalid Sticky.io configuration identifier.', { status: 400 });
        }
        // ... use stickyBaseUrl in callStickyApi ...
        ```
    *   **Gateway ID Logic:**
        *   In `handleCheckout`: After a successful `callStickyNewOrder`, extract the `gateway_id` from the Sticky.io response and include it in the response sent back to the client.
        *   In `handleUpsell`: Read the `gateway_id` sent by the client (e.g., from `X-Gateway-ID` header or body). Pass this `gateway_id` to the `callStickyUpsell` function.
    *   **Update `callStickyUpsell` (`src/lib/sticky.ts`)**: Modify the function signature and payload to accept and include the optional `gateway_id` when making the API call to Sticky.io. Update relevant types (`StickyUpsellPayload` in `src/types.ts`).

## Workflow Diagram

```mermaid
graph TD
    subgraph Browser (Client)
        A[Site Config: SITE_ID, STICKY_URL_IDENTIFIER] --> B{API Util};
        B -- API Call + Headers(X-Site-ID, X-Sticky-Url-Id, [X-Gateway-ID]) --> C{Cloudflare Worker Endpoint};
    end

    subgraph Cloudflare Worker
        C -- Request --> D{Worker Handler};
        E[Internal Map: STICKY_URL_MAP] --> D;
        D -- Reads Headers --> F{Get SiteID, URL_ID, [GatewayID]};
        F & E -- Look up URL --> G[Resolve stickyBaseUrl];
        F & G -- Process Request --> H{Call Sticky.io API (using resolved URL, + GatewayID if upsell)};
        H -- Response --> D;
        D -- Response --> C;
    end

    C -- Response --> B;
```

## Benefits

*   **Secure:** Actual Sticky.io URLs are not exposed to the client browser.
*   **Maintainable:** Adding new sites using *existing* URLs only requires monorepo changes. Adding *new* URLs requires a simple update to the worker's map.
*   **Simplified Architecture:** Avoids the need for a Next.js proxy just for URL handling.

## Considerations

*   The `STICKY_URL_MAP` in the worker code needs to be kept up-to-date if new Sticky.io instances are added.
*   Consistent header names (`X-Site-ID`, `X-Sticky-Url-Id`, `X-Gateway-ID`) should be used between client and worker.