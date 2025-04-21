# Decision Log

---

**Date:** 2025-04-16

**Context:** Debugging and implementing KV-driven pixel logic for `/api/page-pixels`.

**Decisions & Findings:**

1.  **Wrangler KV CLI Syntax:** Corrected `wrangler kv key put/get` commands in `scripts/populate-local-kv.sh` and for manual checks. The correct syntax requires flags like `--binding` and `--local` *after* the key/value, and uses `kv key put` (space) not `kv:key put` (colon).
2.  **Frontend Context Parameters:**
   *   Clarified URL parameter meanings: `affId` (Network ID), `c1` (Affiliate ID), `c2` (Campaign ID), `ef_transaction_id` (Pre-existing Everflow Transaction ID).
   *   Updated `layout.tsx` to send these as distinct fields in the JSON payload to `/api/page-pixels`, rather than conflating `c1` and `affId`.
3.  **Backend Parameter Replacement:**
   *   Implemented logic in `src/index.ts` within the `/api/page-pixels` handler.
   *   After fetching an action definition from KV, the code now iterates through its `params` object.
   *   Placeholders like `PARAM:c1`, `PARAM:c2`, `PARAM:_ef_transaction_id` are replaced with corresponding values from the incoming request body (`body.c1`, `body.campid`, `body.ef_transaction_id`).
   *   If a parameter from the URL/body is missing or null, the corresponding `PARAM:` placeholder is replaced with an empty string (`''`).
4.  **Transaction ID Handling:** Decided to pass the `ef_transaction_id` from the frontend (originating from the URL) rather than generating a new UUID in the worker, as the ID is expected to exist before the user lands on the page. Mapped `PARAM:_ef_transaction_id` to `body.ef_transaction_id`.
5.  **Logging:** Added detailed logging in `src/index.ts` to trace request body content, KV fetches, rule matching, and parameter replacement steps.
6.  **Documentation:** Updated main `README.md` with a section explaining the KV-driven logic and parameter replacement. (This log entry serves as the update for the `memory-bank` directory).

---

[2025-04-13 21:14:45] - Decided to use Cloudflare Workers for serverless pixel routing due to low latency and edge execution.
[2025-04-13 21:14:45] - Chose Cloudflare KV for dynamic, live-updatable config management (scrub %, pixel URLs).
[2025-04-13 21:14:45] - Implemented logic to only fire postbackUrl for "normal" conversions, not for "scrub".
[2025-04-13 21:14:45] - Migrated all project files to the root directory for simpler deployment and management.
[2025-04-13 21:15:06] - Set up initial memory bank for project context tracking.
## Decision

[2025-04-14 11:05:00] - Adopted a hybrid configuration approach using separate JSON files per site (`config/sites/siteName.json`) combined with Cloudflare KV for dynamic/frequently updated values (e.g., Offer IDs, Campaign IDs).

## Rationale

Addresses user concerns about managing a single large JSON file and facilitates easier updates of specific parameters without code deployment. Leverages native Cloudflare features (KV, Secrets) for efficiency and security. Provides clear separation between structural configuration (JSON) and dynamic data (KV).

## Implementation Details

- Site structure defined in individual JSON files within `config/sites/`.
- Dynamic values referenced in JSON using placeholders (e.g., `{KV:key_name}`, `{URL:param_name}`, `{SECRET:secret_name}`).
- A placeholder resolution engine will be implemented in the worker to fetch values from KV, URL, and Secrets at runtime.
- Cloudflare KV namespace to be created and bound.
- Worker Secrets to be used for sensitive API keys.
- Code refactoring required in `config.ts`, `router.ts`, `handler.ts`, `types.ts`, `pixel.ts`, and potentially a new `api.ts`.

---

**Date:** 2025-04-18

**Context:** Fixing "Could not load order details" error on `drivebright` thank you page.

**Decision:** Implement a proxy pattern for fetching order details.
  - The Next.js thank you page (`thank-you/page.tsx`) calls a Next.js API route (`/api/order-confirmation`).
  - The Next.js API route (`src/app/api/order-confirmation/route.ts`) calls a new Cloudflare worker endpoint (`/api/order-details/:orderId`).
  - The Cloudflare worker endpoint (`src/index.ts`) calls the Sticky.io API (`GET /orders/{order_id}`) using credentials stored in worker secrets (`STICKY_USERNAME`, `STICKY_PASSWORD`).

**Rationale:** Keeps Sticky.io credentials secure within the worker environment, preventing exposure to the frontend or Next.js server. Follows the existing pattern used for creating orders via the worker.

**Implementation Details:**
  - Added `GET /api/order-details/:orderId` handler to `src/index.ts` in the worker project.
  - Modified `src/app/api/order-confirmation/route.ts` in the `drivebright` project to call the worker endpoint using `process.env.NEXT_PUBLIC_WORKER_URL`.
  - Added CORS handling for the new worker endpoint.
  - Mapped Sticky.io response fields to the `OrderConfirmation` interface required by the frontend.


---

**Date:** 2025-04-18 (Correction)

**Context:** Correcting the implementation for fetching order details based on user feedback and Sticky.io API documentation (`order_view` endpoint).

**Decision:** Modify the proxy pattern implementation.
  - Change worker endpoint to `POST /api/order-details` (expecting `orderId` in body).
  - Update worker handler to call Sticky.io `POST /order_view` with `order_id` in the body.
  - Change Next.js API route `/api/order-confirmation` to `POST` (expecting `orderId` in body).
  - Update Next.js API route to call worker `POST /api/order-details` with `orderId` in body.
  - Update `thank-you/page.tsx` to call `POST /api/order-confirmation` with `orderId` in body.

**Rationale:** Aligns the implementation with the actual Sticky.io API requirements for fetching order details.

**Implementation Details:**
  - Modified `src/index.ts` (worker): Changed route, method, Sticky.io URL, payload, and mapping.
  - Modified `src/app/api/order-confirmation/route.ts` (Next.js): Changed method, body parsing, and worker call.
  - Modified `src/app/(checkout)/thank-you/page.tsx` (Next.js): Changed fetch method, headers, and body.


[2025-04-19 12:13:19] - Confirmed Sticky.io 'new_upsell' API endpoint creates a new order linked to previousOrderId, returning a new order_id for the upsell transaction. This clarifies the behavior for the drivebright site's upsell flow.

[2025-04-19 12:36:33] - Architectural Decision: Moved primary upsell processing logic (including Sticky.io API call, scrub rule application, and conditional pixel firing) from the Next.js frontend API route (`/api/upsell`) to the Cloudflare Worker (`/api/upsell` endpoint). The Next.js route now acts as a simple proxy. This centralizes business logic and leverages KV for configuration.

[2025-04-19 12:44:18] - Refinement: Added `[siteId]_rule_payoutCpa` KV rule to control upsell action execution in the worker. If "1", only checkout actions fire. If "2" (or default), upsell actions fire based on scrub rules after a successful Sticky.io upsell call.
