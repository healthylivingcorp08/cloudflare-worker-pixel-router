# Decision Log

[2025-04-13 21:14:45] - Decided to use Cloudflare Workers for serverless pixel routing due to low latency and edge execution.
[2025-04-13 21:14:45] - Chose Cloudflare KV for dynamic, live-updatable config management (scrub %, pixel URLs).
[2025-04-13 21:14:45] - Implemented logic to only fire postbackUrl for "normal" conversions, not for "scrub".
[2025-04-13 21:14:45] - Migrated all project files to the root directory for simpler deployment and management.
[2025-04-13 21:15:06] - Set up initial memory bank for project context tracking.