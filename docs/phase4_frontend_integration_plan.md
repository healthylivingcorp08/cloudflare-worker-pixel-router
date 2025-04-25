# Phase 4: Frontend Integration Plan

**Goal:** Integrate frontend websites (starting with `drivebright`) with the Cloudflare Worker Pixel Router, ensuring a reusable, efficient, and maintainable solution.

**Core Strategy:** Develop a dedicated client-side library/module (`pixel-router-client`) to encapsulate all interactions with the Cloudflare Worker endpoints. This library will be the primary reusable component across different frontend sites.

```mermaid
graph TD
    subgraph Frontend (e.g., drivebright - Next.js)
        UI_Components[Checkout/Upsell UI Components] --> ClientLib[pixel-router-client Library]
        ClientLib --> StateMgmt[State Management (internal_txn_id, etc.)]
    end

    subgraph Cloudflare Worker
        Endpoint_Decide[/api/decide-campaign]
        Endpoint_Checkout[/ (Checkout Proxy)]
        Endpoint_Upsell[/api/upsell]
        Endpoint_PayPalReturn[/checkout/paypal-return]
    end

    ClientLib -- Generates internal_txn_id --> StateMgmt
    ClientLib -- Calls /api/decide-campaign --> Endpoint_Decide
    ClientLib -- Calls / (Checkout Proxy) --> Endpoint_Checkout
    ClientLib -- Calls /api/upsell --> Endpoint_Upsell
    Endpoint_Checkout -- PayPal Redirect --> Browser[User's Browser]
    Browser -- Redirects to Worker --> Endpoint_PayPalReturn
    Endpoint_PayPalReturn -- Redirects back to Frontend --> UI_Components

    Endpoint_Decide -- Returns targetCampaignId --> ClientLib
    Endpoint_Checkout -- Returns Success/Error/ClientActions/PayPalRedirectURL --> ClientLib
    Endpoint_Upsell -- Returns Success/Error/ClientActions --> ClientLib
    Endpoint_PayPalReturn -- Triggers Server Actions & Redirects --> Browser

    ClientLib -- Executes --> ClientActions[Client-Side Scripts (Pixels/Analytics)]
```

**Detailed Steps:**

1.  **Develop `pixel-router-client` Library/Module:**
    *   **Location:** Create a new package within the `ecommerce-monorepo` (e.g., `packages/pixel-router-client`) or a shared directory within `drivebright` initially, designed for easy extraction later.
    *   **Functionality:**
        *   **Initialization:** Configure with the Worker URL (via environment variables like `NEXT_PUBLIC_PIXEL_WORKER_URL`).
        *   **ID Generation:** Utility to generate `internal_txn_id` (e.g., using UUID).
        *   **State Management:** Provide helpers or guidance for managing `internal_txn_id` across the user journey (React Context, Zustand, localStorage, etc.).
        *   **API Functions:**
            *   `decideCampaign(trackingParams)`: Calls worker `/api/decide-campaign`, returns `{ targetCampaignId }`.
            *   `submitCheckout(checkoutPayload, internal_txn_id, targetCampaignId)`: Calls worker `/`, handles card success/failure, PayPal redirect info. Returns `{ success: boolean, orderId?: string, clientSideActions?: string[], redirectUrl?: string, error?: string }`.
            *   `submitUpsell(upsellPayload, internal_txn_id)`: Calls worker `/api/upsell`. Returns `{ success: boolean, orderId?: string, clientSideActions?: string[], error?: string }`.
            *   `executeClientScripts(scripts: string[])`: Safely executes the client-side action scripts returned by the worker (e.g., by creating and appending script elements to the DOM).
        *   **Error Handling:** Implement robust error handling for fetch requests and worker responses.

2.  **Integrate `pixel-router-client` into `drivebright`:**
    *   **Dependency:** Add the new library/module.
    *   **Configuration:** Set up `NEXT_PUBLIC_PIXEL_WORKER_URL` in `.env.local` or environment configuration.
    *   **Checkout Flow (`src/components/checkout/CheckoutForm.tsx`, `src/app/(checkout)/...`, `src/context/CheckoutContext.tsx`):**
        *   Generate `internal_txn_id` when the checkout process begins and store it using the chosen state management approach.
        *   Call `pixelRouterClient.decideCampaign()` with relevant tracking parameters *before* allowing form submission (potentially disabling the submit button until resolved). Store the returned `targetCampaignId`.
        *   On form submission, instead of calling Sticky.io directly or the old `/api/checkout/route.ts`, call `pixelRouterClient.submitCheckout()` passing the form data, `internal_txn_id`, and `targetCampaignId`.
        *   Handle the response:
            *   On error, display feedback.
            *   For PayPal, redirect the user: `window.location.href = response.redirectUrl`.
            *   On card success, display confirmation, call `pixelRouterClient.executeClientScripts(response.clientSideActions)`.
    *   **Upsell Flow (Relevant Upsell Components):**
        *   Retrieve the existing `internal_txn_id` from state.
        *   On upsell acceptance/rejection, call `pixelRouterClient.submitUpsell()` with the upsell data and `internal_txn_id`.
        *   Handle the response: Call `pixelRouterClient.executeClientScripts(response.clientSideActions)`, navigate to the next step or thank you page.
    *   **PayPal Return Handling:**
        *   Ensure the redirect URL configured within the worker for PayPal points to the worker's `/checkout/paypal-return?txn={internal_txn_id}` endpoint.
        *   The worker's `/checkout/paypal-return` endpoint will handle the Sticky.io `order_view` confirmation and trigger server/client actions.
        *   The worker will then redirect the user back to a designated frontend confirmation/thank you page (e.g., `/checkout/confirmation?status=success&txn={internal_txn_id}`).
        *   This frontend confirmation page should be prepared to potentially display status messages based on the redirect parameters. It *doesn't* need to re-trigger actions, as the worker already handled that.
    *   **Cleanup:** Remove or disable the old frontend API route (`src/app/api/checkout/route.ts`) and the potentially redundant `public/pixel.worker.js`.

3.  **Testing:**
    *   Perform end-to-end tests for the complete card checkout flow, including upsells.
    *   Perform end-to-end tests for the complete PayPal checkout flow, including upsells.
    *   Verify that `internal_txn_id` is correctly generated, stored, and passed between frontend and worker.
    *   Use browser developer tools (Network tab, Console) to confirm:
        *   Calls to worker endpoints are correct.
        *   Client-side scripts returned by the worker are executed successfully.
        *   Server-side actions (like Everflow postbacks) are triggered (requires checking Everflow or logs if possible).

4.  **Documentation & Templating:**
    *   Write clear documentation for the `pixel-router-client` library, explaining its API, configuration, and state management recommendations.
    *   Provide a concise example of how to integrate it into a Next.js checkout form component.
    *   This library + documentation serves as the "template" for integrating other sites.

**Benefits of this Approach:**

*   **Reusability:** The `pixel-router-client` encapsulates all worker communication logic, making it easy to reuse across multiple frontend sites.
*   **Developer Experience:** Frontend developers interact with a clean, simplified API (`decideCampaign`, `submitCheckout`, etc.) without needing deep knowledge of the worker's internal logic or Sticky.io specifics handled by the proxy.
*   **Maintainability:** Centralizes the frontend-worker interaction logic, making updates easier.
*   **Separation of Concerns:** Frontend focuses on UI and user interaction, worker handles backend orchestration and pixel logic, `pixel-router-client` bridges the two.