# Product Context

**Project:** Cloudflare Worker Pixel Router

**Description:**  
A serverless Cloudflare Worker that routes conversion events to different pixels/postbacks based on configurable scrub percentages per site. Supports dynamic config via KV, secure routing, and easy management for multiple ecommerce sites.

**Key Features:**
- Accepts POST requests with order/conversion data.
- Routes conversions to "normal" or "scrub" pixels based on per-site scrub %.
- Fires postback URLs only for "normal" conversions.
- Configuration managed via Cloudflare KV for live updates.
- Designed for low latency, security, and easy multi-site management.

---
[2025-04-13 21:14:45] - Initial product context created.
[2025-04-14 10:37:00] - Added computer-specific workspace paths:
- Windows 11 PC (Worker): C:\Users\88Devs\Documents\VsCode\cloudflare-worker-pixel-router
- Windows 11 PC (Sites): C:\Users\88Devs\Documents\VsCode\tech-ecom\ecommerce-monorepo\sites
- Windows 10 PC (Worker): C:\Users\STD\Documents\VsCode\server_cloudflare_tech
## Relationship to `tech-ecom` Monorepo

- Windows 10 PC (Drivebright Site Source): C:\Users\STD\Documents\VsCode\tech-ecom\ecommerce-monorepo\sites\drivebright\src

This Cloudflare Worker Pixel Router is designed as a central component for the e-commerce sites managed within the `tech-ecom` monorepo project (`../tech-ecom/ecommerce-monorepo`). Currently, the plan is for this single worker instance to handle conversion tracking, pixel firing, and CRM integration logic for *all* sites deployed from that monorepo (hosted on Cloudflare Pages). Configuration for all sites is managed centrally via this worker's associated Cloudflare KV namespace. Future scaling might involve multiple worker instances if load requires it.