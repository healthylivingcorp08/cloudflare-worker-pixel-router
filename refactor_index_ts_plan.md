# Refactoring Plan for src/index.ts

This plan outlines the strategy to refactor the large `src/index.ts` file into smaller, more manageable modules with distinct responsibilities.

## Goals

*   Improve code organization and readability.
*   Separate concerns (routing, API logic, external service interaction, utilities).
*   Enhance maintainability and testability.

## Proposed Module Structure

1.  **Core Types (`src/types.ts`)**
    *   Consolidate shared interfaces: `Env`, `PixelState`, `PaymentData`, `StickyPayload`, `Address`, `Product`, `OrderConfirmation`, `EncryptedData`.
    *   *Action:* Review existing `src/types.ts` and add missing interfaces from `src/index.ts`.

2.  **Sticky.io API Client (`src/lib/sticky.ts`)**
    *   Create a dedicated module for Sticky.io API interactions.
    *   Move `callStickyNewOrder` logic.
    *   Create `callStickyUpsell` based on `/api/upsell` handler logic.
    *   Create `callStickyOrderView` based on `/api/order-details` handler logic.
    *   Encapsulate `fetch` calls, authentication, URL construction, and basic response handling.

3.  **Middleware (`src/middleware/`)**
    *   **CORS (`src/middleware/cors.ts`):** Extract `allowedOrigins`, `handleOptions`, `addCorsHeaders`.
    *   **Admin Auth (`src/admin/middleware/auth.ts`):** Keep existing admin auth middleware.

4.  **API Handlers (`src/handlers/`)**
    *   Create separate files for each API endpoint's logic. Each handler receives `request`, `env`, `ctx`.
    *   `src/handlers/decideCampaign.ts`: Logic for `POST /api/decide-campaign`.
    *   `src/handlers/orderDetails.ts`: Logic for `POST /api/order-details` (using `callStickyOrderView`).
    *   `src/handlers/checkout.ts`: Logic for `POST /` (main checkout flow, using `callStickyNewOrder`, `decryptData`, KV ops, `triggerInitialActions`).
    *   `src/handlers/upsell.ts`: Logic for `POST /api/upsell` (using `callStickyUpsell`).
    *   `src/handlers/pagePixels.ts`: Logic for `GET /api/page-pixels`.
    *   `src/handlers/checkoutRules.ts`: Logic for `POST /api/checkout-rules` (Evaluate necessity).

5.  **Action/Pixel Processing (`src/actions/` or `src/processing/`)**
    *   Keep `triggerInitialActions` in `src/actions.ts`.
    *   Move helper functions `resolveParameters`, `generatePixel`, `callApiEndpoint` to `src/actions/execution.ts` or `src/processing/engine.ts`.

6.  **Utilities (`src/utils/`)**
    *   Keep `decryptData` in `src/utils/encryption.ts`.
    *   Move `isAdminPublicPath` to `src/admin/utils.ts` or `src/utils/routing.ts`.

7.  **Main Router (`src/router.ts`)**
    *   Create a central `handleRequest` function.
    *   Handles admin routing/proxying (delegating to `src/admin/router.ts`).
    *   Handles CORS preflight (`handleOptions`).
    *   Routes API requests to `src/handlers/`.
    *   Applies CORS headers (`addCorsHeaders`).

8.  **Entry Point (`src/index.ts`)**
    *   Minimal file.
    *   Imports `handleRequest` from `src/router.ts`.
    *   Default export `fetch` calls `handleRequest` within a top-level try/catch.

## Implementation Steps (High-Level)

1.  Create `src/lib/sticky.ts`.
2.  Create `src/middleware/cors.ts`.
3.  Create handler files in `src/handlers/`.
4.  Create `src/actions/execution.ts` (or similar).
5.  Create `src/router.ts`.
6.  Refactor `src/types.ts` to include all necessary types.
7.  Refactor `src/utils/encryption.ts` (if needed).
8.  Refactor `src/actions.ts`.
9.  Move logic from `src/index.ts` to the new modules, updating imports/exports.
10. Rewrite `src/index.ts` to be the minimal entry point.