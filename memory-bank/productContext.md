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
- Windows 11 PC: C:\Users\88Devs\Documents\VsCode\cloudflare-worker-pixel-router
- Windows 10 PC: C:\Users\STD\Documents\VsCode\server_cloudflare_tech