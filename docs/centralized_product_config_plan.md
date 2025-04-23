# Plan: Centralized Product Configuration

**Goal:** Refactor the `drivebright` site to use a centralized configuration file (`config/products.ts`) for managing all product details (base, upsell, downsell) to improve maintainability and consistency.

**Steps:**

1.  **Create `config/products.ts`:**
    *   Define `ProductOffer`, `ProductDetails` interfaces.
    *   Create `allProducts` array with placeholder data for base and upsell/downsell products.
    *   Implement helper functions: `getUpsellProductDetails`, `getBaseProducts`, `getProductById`.
    *   **File:** `../tech-ecom/ecommerce-monorepo/sites/drivebright/src/config/products.ts`

2.  **Refactor `ProductOptions.tsx`:**
    *   Import `getBaseProducts` from `config/products.ts`.
    *   Update component to use `ProductDetails` structure for rendering options.
    *   Adjust props and `onProductChange` handler.
    *   **File:** `../tech-ecom/ecommerce-monorepo/sites/drivebright/src/components/product/ProductOptions.tsx`

3.  **Refactor Checkout Page (e.g., `src/app/page.tsx`):**
    *   Update usage of `ProductOptions.tsx`.
    *   Adjust selected product state management.
    *   **File:** `../tech-ecom/ecommerce-monorepo/sites/drivebright/src/app/page.tsx` (or relevant page)

4.  **Refactor `inter/page.tsx`:**
    *   Import `getUpsellProductDetails`.
    *   Replace old product logic.
    *   Use `ProductDetails` for dynamic display (name, price) and payload generation (`shippingId`, `offers`).
    *   **File:** `../tech-ecom/ecommerce-monorepo/sites/drivebright/src/app/inter/page.tsx`

5.  **Refactor Other Static Upsell Pages (If any):**
    *   Apply similar logic as Step 4 to any separate upsell page files.

6.  **Verify/Refactor Thank You Page:**
    *   Check how product data is obtained and displayed.
    *   Refactor if necessary.
    *   **File:** `../tech-ecom/ecommerce-monorepo/sites/drivebright/src/app/thank-you/page.tsx` (or relevant page)

7.  **Update `pixel-router-client.ts`:**
    *   Update `UpsellPayload` interface to include `shippingId` and `offers`.
    *   Ensure `submitUpsell` function sends the correct structure.
    *   **File:** `../tech-ecom/ecommerce-monorepo/sites/drivebright/src/lib/pixel-router-client.ts`

8.  **Verify Worker Endpoint (`/api/upsell`):**
    *   Manually check or create a separate task to ensure the Cloudflare worker endpoint correctly parses `shippingId` and `offers` from the request body.

**Diagram:**

```mermaid
graph TD
    A[1. Create config/products.ts] --> B(2. Refactor ProductOptions.tsx);
    B --> C(3. Refactor Checkout Page);
    A --> D(4. Refactor inter/page.tsx);
    A --> E(5. Refactor Other Upsell Pages);
    A --> F(6. Verify/Refactor Thank You Page);
    A --> G(7. Update pixel-router-client.ts);
    G --> H(8. Verify Worker /api/upsell);
    D --> G;