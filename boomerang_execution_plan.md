# Boomerang Execution Plan: Cloudflare Worker Pixel Router (v4.1)

Based on `kv_pixel_fires_checkout_plan.md`.

## Phase 1: Setup & Configuration
- mark each task as completed when you're finished in this file. 
-   [X] **Define KV Namespaces:**
    -   [X] Create `PIXEL_STATE` namespace for transaction state.
    -   [X] Create `PIXEL_CONFIG` namespace for rules and actions.
-   [X] **Populate `PIXEL_CONFIG`:**
    -   [X] Set `global_scrub_percent`.
    -   [X] Set `network_scrub_percent:{affId}` (for relevant networks).
    -   [X] Set `affiliate_scrub_percent:{c1}` (for relevant affiliates).
    -   [X] Set `normal_campaign_id`.
    -   [X] Set `scrub_campaign_id`.
    -   [X] Set `payout_steps`.
    -   [X] Define `checkoutNormalActions` list.
    -   [X] Define `upsell1NormalActions` list.
    -   [X] Define `upsell2NormalActions` list.
    -   [X] Define `action:FacebookPurchase` template.
    -   [X] Define `action:GoogleAnalyticsPurchase` template.
    -   [X] Define `action:EverflowPostback` template.
    -   [X] Define `action:EverflowConversionPixel` template.
    -   [X] Define any other required action templates (e.g., `action:FacebookUpsell`).

## Phase 2: Core Logic Implementation

-   [X] **Implement `/api/decide-campaign` Endpoint:**
    -   [X] Read input parameters (`internal_txn_id`, tracking params).
    -   [X] Fetch scrub rules and campaign IDs from `PIXEL_CONFIG`.
    -   [X] Implement scrub percentage calculation logic.
    -   [X] Determine `isScrub` and `targetCampaignId`.
    -   [X] Construct initial `PIXEL_STATE` KV entry.
    -   [X] Write state to KV with TTL (using `waitUntil`).
    -   [X] Return `targetCampaignId`.
-   [X] **Implement Parameter Population Utility:**
    -   [X] Create function `populateParameters(template, dataSources)`.
    -   [X] Implement logic to replace `PARAM:` placeholders using `PIXEL_STATE`, Sticky.io data, request object, and environment variables.
    -   [X] Handle missing parameters gracefully.
    -   [X] Include necessary data transformations (e.g., timestamp formats, phone normalization if needed).
-   [X] **Implement Action Triggering Helpers:**
    -   [X] Create `triggerInitialActions` function:
        -   [X] Read state from `PIXEL_STATE`.
        -   [X] Implement idempotency check (`processed_Initial`).
        -   [X] Update KV state (mark processed, set status/timestamp).
        -   [X] Fetch `payout_steps`.
        -   [X] Check if `payout_steps >= 1`.
        -   [X] Fetch relevant action keys and definitions from `PIXEL_CONFIG`.
        -   [X] Call `populateParameters` for each action.
        -   [X] Execute server-side actions asynchronously (`context.waitUntil`).
        -   [X] Return client-side action scripts.
    -   [X] Create `triggerUpsellActions` function:
        -   [X] Read state from `PIXEL_STATE`.
        -   [X] Implement idempotency check (step-specific flag, e.g., `processed_Upsell_1`).
        -   [X] Update KV state (mark step processed, set timestamp).
        -   [X] Fetch relevant action keys and definitions from `PIXEL_CONFIG`.
        -   [X] Call `populateParameters` for each action.
        -   [X] Execute server-side actions asynchronously (`context.waitUntil`).
        -   [X] Return client-side action scripts.
-   [X] **Implement `/` (Checkout Proxy & Card Confirmation) Endpoint:**
    -   [X] Read input payload, `targetCampaignId`, `internal_txn_id`.
    -   [X] Determine payment method.
    -   [X] Update `PIXEL_STATE` with payment method.
    -   [X] Construct Sticky.io `NewOrder` payload.
    -   [X] Call Sticky.io `NewOrder` API.
    -   [X] Update `PIXEL_STATE` with `stickyOrderId_Initial`.
    -   [X] Handle Card Success: Call `triggerInitialActions`, return success + client actions.
    -   [X] Handle Card Failure: Update `PIXEL_STATE`, return error.
    -   [X] Handle PayPal Redirect: Update `PIXEL_STATE`, return redirect info.
    -   [X] Handle PayPal Failure: Update `PIXEL_STATE`, return error.
-   [X] **Implement `/checkout/paypal-return` Endpoint:**
    -   [X] Read `internal_txn_id` from query params.
    -   [X] Read state from `PIXEL_STATE`. Handle errors/already processed.
    -   [X] Call Sticky.io `order_view` API using `stickyOrderId_Initial`.
    -   [X] Check `order_view` response for success.
    -   [X] Handle Success: Call `triggerInitialActions`, prepare redirect to confirmation page.
    -   [X] Handle Failure/Pending: Update `PIXEL_STATE`, redirect to error/pending page.
-   [X] **Implement `/api/upsell` Endpoint:**
    -   [X] Read input payload, `internal_txn_id`.
    -   [X] Read initial state from `PIXEL_STATE`.
    -   [X] Determine `currentUpsellStep`.
    -   [X] Fetch `payout_steps` and campaign IDs from `PIXEL_CONFIG`.
    -   [X] Get initial `isScrub` from state.
    -   [X] Determine `targetUpsellCampaignId` based on initial `isScrub`.
    -   [X] Construct Sticky.io `new_upsell` payload.
    -   [X] Call Sticky.io `new_upsell` API.
    -   [X] Update `PIXEL_STATE` with `stickyOrderId_Upsell_{N}`.
    -   [X] Handle Success: Check `payout_steps`, call `triggerUpsellActions` if applicable, return success + client actions.
    -   [X] Handle Failure: Return error.

## Phase 3: Testing & Deployment

-   [X] **Unit Testing:**
    -   [X] Test scrub calculation logic.
    -   [X] Test parameter population utility.
    -   [X] Test action triggering helpers (mocking KV and API calls).
    -   [X] Test individual endpoint logic (mocking dependencies).
-   [X] **Integration Testing:**
    -   [X] Test full card checkout flow.
    -   [X] Test full PayPal checkout flow.
    -   [X] Test upsell flow (with and without scrub).
    -   [X] Verify KV state updates correctly.
    -   [X] Verify action parameters are populated correctly.
    -   [X] Verify `payout_steps` logic is respected.
-   [X] **Deployment:**
    -   [X] Configure Wrangler secrets (API keys, tokens).
    -   [X] Deploy worker to Cloudflare.
    -   [X] Monitor logs for errors.

## Phase 4: Frontend Integration

-   [X] **Update Frontend:**
    -   [X] Implement call to `/api/decide-campaign` *before* payment initiation.
    -   [X] Pass `internal_txn_id` consistently through checkout and upsell flows.
    -   [X] Use `targetCampaignId` from `/api/decide-campaign` response for initial Sticky.io call.
    -   [X] Handle client-side actions returned by worker endpoints (`/`, `/api/upsell`, `/checkout/paypal-return`).
    -   [X] Update PayPal return URL to point to the worker's `/checkout/paypal-return` endpoint, including the `internal_txn_id`.
---
## Action Log

*   **2025-04-21:** Generated the initial execution plan checklist based on `kv_pixel_fires_checkout_plan.md` and saved it to this file (`boomerang_execution_plan.md`).
*   **2025-04-21:** Implemented `triggerInitialActions` and `triggerUpsellActions` helpers in `src/actions.ts`. Updated `src/utils/parameters.ts` and `src/types.ts` for type compatibility. Marked task as complete in plan.
*   **2025-04-21:** Updated existing `/api/decide-campaign` endpoint logic in `src/index.ts` to use `ctx.waitUntil()` for KV write. Marked task as complete in plan.
*   **2025-04-21:** Implemented `POST /` endpoint in `src/index.ts` for checkout proxy (Card & PayPal initiation), including Sticky.io `NewOrder` call and `triggerInitialActions`. Marked task as complete in plan.
*   **2025-04-22:** Completed unit testing for parameter utilities and action triggers. Fixed TypeScript errors and removed outdated files (`handler.ts`, `pixel.ts`, `resolvers.ts`). All tests now passing.