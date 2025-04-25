# System Patterns

## Patterns Used

- **Serverless Edge Routing:**  
  Uses Cloudflare Workers to handle conversion events at the edge for low latency and scalability.

- **Configurable Routing via KV:**  
  Per-site scrub percentages and pixel/postback URLs are managed in Cloudflare KV, allowing live updates without redeploy.

## Architectural Patterns

*   [2025-04-14 11:06:00] - **Hybrid Configuration (JSON per Site + Cloudflare KV):**
    *   **Description:** Site-specific configuration (page structure, pixel types, API endpoint types) is stored in individual JSON files (e.g., `config/sites/siteName.json`). Dynamic, frequently changing, or sensitive values (Offer IDs, Campaign IDs, API endpoints, potentially keys) are stored in Cloudflare KV or Worker Secrets and referenced in the JSON using placeholders (e.g., `{KV:key_name}`, `{SECRET:secret_name}`, `{URL:param_name}`).
    *   **Rationale:** Improves maintainability over a single large JSON file, allows non-developers to update specific parameters easily via KV, leverages Cloudflare-native features, separates structural config from dynamic data.
    *   **Usage:** Worker code loads the relevant site JSON, resolves placeholders at runtime by fetching values from KV/Secrets/URL, then uses the fully resolved config to generate pixels and API calls.

- **Conditional Postback Logic:**  
  Only fires postbackUrl for "normal" conversions, never for "scrub" conversions.

- **Separation of Concerns:**  
  Modular codebase with clear separation between handler, routing, config, pixel firing, and logging.

- **Multi-Computer Environment:**
  Memory Bank detects current computer (Windows 11: 88Devs or Windows 10: STD) to use correct paths automatically.

---
[2025-04-13 21:15:25] - Initial system patterns documented.
[2025-04-14 10:37:40] - Added Multi-Computer Environment pattern for Memory Bank path detection.
[2025-04-19 12:20:35] - Guiding Principle: When recording architectural patterns, file locations, or processes in the memory bank, strive to generalize them using placeholders like `[site-name]` so the information applies across all sites in the monorepo, rather than using static paths specific to one site (e.g., prefer `sites/[site-name]/src/components/checkout/` over `sites/drivebright/src/components/checkout/`).
[2025-04-19 21:12:16] - Project Structure Summary

Worker Entry Point: src/index.ts is the main entry point, handling incoming requests.
Core Logic: src/handler.ts and src/router.ts likely contain the primary routing and request handling logic for non-admin routes. src/pixel.ts handles pixel/postback logic.
Admin Functionality:
API: Handlers for admin operations (site config, KV management) are in src/admin/api/config.ts and src/admin/api/kv.ts.
Authentication: src/admin/middleware/auth.ts secures the admin API.
UI: The wrangler.toml file confirms that the Admin UI is served statically from the src/admin/ui directory (bucket = "./src/admin/ui"). This means src/admin/ui/index.html is the active UI file, and the HTML/JS embedded within src/admin/router.ts is likely redundant or outdated.
Configuration: Site-specific rules, pixel configurations, and actions are stored in the Cloudflare KV namespace bound to PIXEL_CONFIG. Site configurations are stored under keys prefixed with `site_config_` (e.g., `site_config_drivebright`). The admin API lists available sites by querying KV for keys with this prefix.
External Services: The worker interacts with Sticky.io using credentials stored as environment variables/secrets (like STICKY_USERNAME, STICKY_PASSWORD).