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