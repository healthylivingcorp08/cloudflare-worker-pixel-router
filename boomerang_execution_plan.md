# Boomerang Execution Plan: Cloudflare Worker Pixel Router (v4.1)

Based on `kv_pixel_fires_checkout_plan.md`.

## Phase 1: Setup & Configuration

-   [ ] **Define KV Namespaces:**
    -   [ ] Create `PIXEL_STATE` namespace for transaction state.
    -   [ ] Create `PIXEL_CONFIG` namespace for rules and actions.
-   [ ] **Populate `PIXEL_CONFIG`:**
    -   [ ] Set `global_scrub_percent`.
    -   [ ] Set `network_scrub_percent:{affId}` (for relevant networks).
    -   [ ] Set `affiliate_scrub_percent:{c1}` (for relevant affiliates).
    -   [ ] Set `normal_campaign_id`.
    -   [ ] Set `scrub_campaign_id`.
    -   [ ] Set `payout_steps`.
    -   [ ] Define `checkoutNormalActions` list.
    -   [ ] Define `upsell1NormalActions` list.
    -   [ ] Define `upsell2NormalActions` list.
    -   [ ] Define `action:FacebookPurchase` template.
    -   [ ] Define `action:GoogleAnalyticsPurchase` template.
    -   [ ] Define `action:EverflowPostback` template.
    -   [ ] Define `action:EverflowConversionPixel` template.
    -   [ ] Define any other required action templates (e.g., `action:FacebookUpsell`).

## Phase 2: Core Logic Implementation

-   [ ] **Implement `/api/decide-campaign` Endpoint:**
    -   [ ] Read input parameters (`internal_txn_id`, tracking params).
    -   [ ] Fetch scrub rules and campaign IDs from `PIXEL_CONFIG`.
    -   [ ] Implement scrub percentage calculation logic.
    -   [ ] Determine `isScrub` and `targetCampaignId`.
    -   [ ] Construct initial `PIXEL_STATE` KV entry.
    -   [ ] Write state to KV with TTL.
    -   [ ] Return `targetCampaignId`.
-   [ ] **Implement Parameter Population Utility:**
    -   [ ] Create function `populateParameters(template, dataSources)`.
    -   [ ] Implement logic to replace `PARAM:` placeholders using `PIXEL_STATE`, Sticky.io data, request object, and environment variables.
    -   [ ] Handle missing parameters gracefully.
    -   [ ] Include necessary data transformations (e.g., timestamp formats, phone normalization if needed).
-   [ ] **Implement Action Triggering Helpers:**
    -   [ ] Create `triggerInitialActions` function:
        -   [ ] Read state from `PIXEL_STATE`.
        -   [ ] Implement idempotency check (`processed_Initial`).
        -   [ ] Update KV state (mark processed, set status/timestamp).
        -   [ ] Fetch `payout_steps`.
        -   [ ] Check if `payout_steps >= 1`.
        -   [ ] Fetch relevant action keys and definitions from `PIXEL_CONFIG`.
        -   [ ] Call `populateParameters` for each action.
        -   [ ] Execute server-side actions asynchronously (`context.waitUntil`).
        -   [ ] Return client-side action scripts.
    -   [ ] Create `triggerUpsellActions` function:
        -   [ ] Read state from `PIXEL_STATE`.
        -   [ ] Implement idempotency check (step-specific flag, e.g., `processed_Upsell_1`).
        -   [ ] Update KV state (mark step processed, set timestamp).
        -   [ ] Fetch relevant action keys and definitions from `PIXEL_CONFIG`.
        -   [ ] Call `populateParameters` for each action.
        -   [ ] Execute server-side actions asynchronously (`context.waitUntil`).
        -   [ ] Return client-side action scripts.
-   [ ] **Implement `/` (Checkout Proxy & Card Confirmation) Endpoint:**
    -   [ ] Read input payload, `targetCampaignId`, `internal_txn_id`.
    -   [ ] Determine payment method.
    -   [ ] Update `PIXEL_STATE` with payment method.
    -   [ ] Construct Sticky.io `NewOrder` payload.
    -   [ ] Call Sticky.io `NewOrder` API.
    -   [ ] Update `PIXEL_STATE` with `stickyOrderId_Initial`.
    -   [ ] Handle Card Success: Call `triggerInitialActions`, return success + client actions.
    -   [ ] Handle Card Failure: Update `PIXEL_STATE`, return error.
    -   [ ] Handle PayPal Redirect: Update `PIXEL_STATE`, return redirect info.
    -   [ ] Handle PayPal Failure: Update `PIXEL_STATE`, return error.
-   [ ] **Implement `/checkout/paypal-return` Endpoint:**
    -   [ ] Read `internal_txn_id` from query params.
    -   [ ] Read state from `PIXEL_STATE`. Handle errors/already processed.
    -   [ ] Call Sticky.io `order_view` API using `stickyOrderId_Initial`.
    -   [ ] Check `order_view` response for success.
    -   [ ] Handle Success: Call `triggerInitialActions`, prepare redirect to confirmation page.
    -   [ ] Handle Failure/Pending: Update `PIXEL_STATE`, redirect to error/pending page.
-   [ ] **Implement `/api/upsell` Endpoint:**
    -   [ ] Read input payload, `internal_txn_id`.
    -   [ ] Read initial state from `PIXEL_STATE`.
    -   [ ] Determine `currentUpsellStep`.
    -   [ ] Fetch `payout_steps` and campaign IDs from `PIXEL_CONFIG`.
    -   [ ] Get initial `isScrub` from state.
    -   [ ] Determine `targetUpsellCampaignId` based on initial `isScrub`.
    -   [ ] Construct Sticky.io `new_upsell` payload.
    -   [ ] Call Sticky.io `new_upsell` API.
    -   [ ] Update `PIXEL_STATE` with `stickyOrderId_Upsell_{N}`.
    -   [ ] Handle Success: Check `payout_steps`, call `triggerUpsellActions` if applicable, return success + client actions.
    -   [ ] Handle Failure: Return error.

## Phase 3: Testing & Deployment

-   [ ] **Unit Testing:**
    -   [ ] Test scrub calculation logic.
    -   [ ] Test parameter population utility.
    -   [ ] Test action triggering helpers (mocking KV and API calls).
    -   [ ] Test individual endpoint logic (mocking dependencies).
-   [ ] **Integration Testing:**
    -   [ ] Test full card checkout flow.
    -   [ ] Test full PayPal checkout flow.
    -   [ ] Test upsell flow (with and without scrub).
    -   [ ] Verify KV state updates correctly.
    -   [ ] Verify action parameters are populated correctly.
    -   [ ] Verify `payout_steps` logic is respected.
-   [ ] **Deployment:**
    -   [ ] Configure Wrangler secrets (API keys, tokens).
    -   [ ] Deploy worker to Cloudflare.
    -   [ ] Monitor logs for errors.

## Phase 4: Frontend Integration

-   [ ] **Update Frontend:**
    -   [ ] Implement call to `/api/decide-campaign` *before* payment initiation.
    -   [ ] Pass `internal_txn_id` consistently through checkout and upsell flows.
    -   [ ] Use `targetCampaignId` from `/api/decide-campaign` response for initial Sticky.io call.
    -   [ ] Handle client-side actions returned by worker endpoints (`/`, `/api/upsell`, `/checkout/paypal-return`).
    -   [ ] Update PayPal return URL to point to the worker's `/checkout/paypal-return` endpoint, including the `internal_txn_id`.