# Decision Log

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
