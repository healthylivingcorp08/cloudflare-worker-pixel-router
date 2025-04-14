# System Patterns

## Patterns Used

- **Serverless Edge Routing:**  
  Uses Cloudflare Workers to handle conversion events at the edge for low latency and scalability.

- **Configurable Routing via KV:**  
  Per-site scrub percentages and pixel/postback URLs are managed in Cloudflare KV, allowing live updates without redeploy.

- **Conditional Postback Logic:**  
  Only fires postbackUrl for "normal" conversions, never for "scrub" conversions.

- **Separation of Concerns:**  
  Modular codebase with clear separation between handler, routing, config, pixel firing, and logging.

---
[2025-04-13 21:15:25] - Initial system patterns documented.