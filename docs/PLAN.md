# Pixel Router Implementation Plan (Phase 1)

## 1. Overview

This plan outlines the architecture for a Cloudflare Worker-based pixel and API routing system. The goal is to provide a flexible, maintainable, and scalable solution for managing different tracking pixels and API calls across various websites and their pages (presell, landing, checkout, upsells).

## 2. Core Architecture: Hybrid JSON + Cloudflare KV

To balance configuration clarity and ease of updating dynamic values, a hybrid approach will be used:

*   **Site-Specific JSON Files:** Each website managed by the worker will have its own configuration file located in `config/sites/` (e.g., `config/sites/siteA.json`, `config/sites/siteB.json`). These files define the site structure, page names, the types of pixels/APIs used on each page, and references to dynamic values.
*   **Cloudflare KV Store:** Frequently changing parameters (like Offer IDs, Campaign IDs, Product IDs provided by ad networks or CRMs) and potentially non-secret configuration values (like API endpoints) will be stored in a Cloudflare KV namespace bound to the worker. This allows updates without code deployment.
*   **Cloudflare Worker Secrets:** Sensitive credentials (like API keys) MUST be stored as Worker Secrets for security.
*   **Placeholder Syntax:** The JSON files will use placeholders to reference values from KV, Secrets, or the incoming request URL:
    *   `{KV:key_name}`: Fetches the value associated with `key_name` from the bound KV namespace.
    *   `{URL:param_name}`: Fetches the value of the query parameter `param_name` from the incoming request URL.
    *   `{SECRET:secret_name}`: Fetches the value of the bound Worker Secret named `secret_name`.
    *   `{CONTEXT:variable_name}`: (Optional) Fetches a value derived during request processing (e.g., calculated order total).

## 3. Configuration Structure Example (`config/sites/siteA.json`)

```json
{
  "scrubPercent": 20, // Site-wide scrub percentage
  "siteId": "siteA", // Identifier
  "pages": {
    "presell": {
      "pixels": [
        {
          "type": "everflow_click", // Identifier for pixel generation logic
          "config": {
            "offer_id": "{KV:siteA_presell_offer_id}",
            "affiliate_id": "{URL:c1}",
            "parameterMapping": {
              "sub1": "{URL:sub1}",
              "uid": "{URL:uid}"
            }
          }
        }
      ],
      "apiEndpoints": []
    },
    "checkout": {
      "pixels": [
        {
          "type": "everflow_conversion",
          "config": {
            "offer_id": "{KV:siteA_checkout_offer_id}"
          }
        }
      ],
      "apiEndpoints": [
        {
          "type": "stickyio_order", // Identifier for API call logic
          "endpoint": "{KV:stickyio_api_endpoint}",
          "method": "POST",
          "config": {
            "campaign_id": "{KV:siteA_checkout_campaign_id}",
            "product_id": "{KV:siteA_checkout_product_id}",
            "api_key": "{SECRET:stickyio_api_key}",
            "customer_email": "{CONTEXT:customer_email}" // Example context value
          }
        }
      ]
    }
    // ... other pages (landing, upsell1, upsell2, thankyou)
  }
}
```

## 4. Worker Logic Flow

1.  **Identify Site:** Determine the target site based on the request (e.g., hostname).
2.  **Load Site JSON:** Load the corresponding `config/sites/siteName.json` file.
3.  **Identify Page:** Determine the target page based on the request path.
4.  **Get Page Config:** Extract the configuration for the identified page from the loaded JSON.
5.  **Resolve Placeholders:** Process the `pixels` and `apiEndpoints` configurations, replacing all placeholders (`{KV:...}`, `{URL:...}`, `{SECRET:...}`) with their actual values by querying KV, reading the URL, and accessing Secrets.
6.  **Execute Scrub Logic:** Apply the site-wide `scrubPercent` to decide if subsequent actions (pixels/APIs for this specific request) should be skipped based on prior interactions (requires state management, potentially using cookies or KV). *Note: Detailed scrub logic implementation needs further definition.*
7.  **Generate/Fire Pixels:** Based on the resolved configuration and scrub decision, generate the necessary pixel script tags or trigger server-side pixel fires.
8.  **Trigger API Calls:** Based on the resolved configuration and scrub decision, prepare and execute any defined API calls (e.g., to CRM).

## 5. High-Level Implementation Steps

1.  **Setup:**
    *   Create `config/sites/` directory.
    *   Create initial site JSON files.
    *   Create and populate Cloudflare KV namespace. Bind to worker in `wrangler.toml`.
    *   Configure and bind Worker Secrets in `wrangler.toml`.
2.  **Types:** Update `src/types.ts` with interfaces for the new configuration structure.
3.  **Config Loading:** Refactor `src/config.ts` to load the correct site JSON dynamically.
4.  **Core Logic:**
    *   Implement placeholder resolution engine in `src/router.ts` or a dedicated module.
    *   Refactor `src/router.ts` and `src/handler.ts` to implement the main logic flow (site/page identification, config loading, placeholder resolution, scrub logic hook).
5.  **Pixel/API Handlers:** Update `src/pixel.ts` and potentially create `src/api.ts` with functions to handle specific `type` identifiers (e.g., `everflow_click`, `stickyio_order`) using the resolved configuration.
6.  **Scrub Logic:** Implement state management and decision logic for scrubbing.
7.  **Testing:** Add unit and integration tests.
8.  **Deployment:** Deploy the worker.

## 6. Phase 2 Considerations

*   **KV Management UI:** A dedicated web UI served by the worker to manage KV values could be built later if needed. This would require frontend development, API endpoints, and robust authentication (e.g., Cloudflare Access).
*   **Advanced Scrub Logic:** More complex scrubbing rules or state management might be required.