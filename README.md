# Cloudflare Worker Pixel Router

A flexible system for managing tracking pixels and API integrations across multiple sites and pages.

## Features

- Configurable pixel routing across multiple sites
- Role-based admin interface for managing configurations
- Support for multiple pixel types (Everflow click/conversion)
- API integration support (e.g., StickyIO orders)
- Scrub percentage handling per site

## Project Structure

```
├── src/
│   ├── admin/              # Admin UI and API
│   │   ├── api/           # Admin API endpoints
│   │   ├── middleware/    # Auth & RBAC
│   │   ├── ui/           # Admin UI files
│   │   ├── router.ts     # Admin route handling
│   │   └── types.ts      # Admin TypeScript types
│   ├── config.ts          # Configuration handling
│   ├── handler.ts         # Main request handler
│   ├── index.ts          # Worker entry point
│   ├── pixel.ts          # Pixel generation logic
│   └── types.ts          # Core TypeScript types
├── config/
│   └── sites/            # Site-specific configurations
├── scripts/              # Utility scripts
└── .github/
    └── workflows/        # GitHub Actions workflows
```

## Deployment

The project is automatically deployed to Cloudflare Workers when changes are pushed to the `main` branch.

### Requirements

1. GitHub repository secrets:
   - `CLOUDFLARE_API_TOKEN`: Your Cloudflare API token
   - `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare account ID

2. Configure these in your GitHub repository:
   1. Go to repository Settings
   2. Navigate to Secrets and Variables > Actions
   3. Add the required secrets

### Manual Development

```bash
# Install dependencies
npm install

# Run locally
npm run dev

# Deploy manually (if needed)
npm run deploy
```

## Configuration

### Site Configuration

Sites are configured in `config/sites/` with individual JSON files per site:

```json
{
  "scrubPercent": 20,
  "siteId": "getamplihear",
  "pages": {
    "presell": {
      "pixels": [...],
      "apiEndpoints": [...]
    }
  }
}
```

### Dynamic Values

Frequently changing values (offer IDs, campaign IDs, etc.) are stored in Cloudflare KV:

```bash
# Update a value (Note: Use `kv key put` syntax)
npx wrangler kv key put siteA_checkout_offer_id "746" --binding PIXEL_CONFIG --local
```

## Admin Interface

Access the admin interface at `/admin/` on your worker domain. Three role levels are available:

1. **Viewer:** View configurations and logs
2. **Pixel Manager:** Viewer + Edit pixels and their values
3. **Admin:** Full system access

## Development Notes

- Push to `main` branch to trigger deployment
- Worker runs at `*.workers.dev` by default
- Set up Cloudflare Access to secure `/admin/*` routes

## API Documentation

### Admin API Endpoints

```
# Site Configuration
GET    /admin/api/sites
GET    /admin/api/config/:siteId
PUT    /admin/api/config/:siteId
POST   /admin/api/config/:siteId

# KV Management
GET    /admin/api/kv/list
GET    /admin/api/kv/:key
PUT    /admin/api/kv/:key
DELETE /admin/api/kv/:key
PUT    /admin/api/kv/bulk

### `/api/page-pixels` Endpoint (KV-Driven Logic)

This endpoint determines which pixels/actions should be executed on a given frontend page load based on rules stored in KV.

**Request (POST):**

```json
{
 "siteId": "drivebright",
 "url": "http://localhost:3000/inter/testpage/?affId=nva&c1=123&c2=CAMP_TEST&ef_transaction_id=ABCDEF12345",
 "affid": "nva", // Network ID (from affId URL param)
 "c1": "123", // Affiliate ID (from c1 URL param)
 "campid": "CAMP_TEST", // Campaign ID (from c2 URL param)
 "ef_transaction_id": "ABCDEF12345" // Pre-existing Transaction ID (from ef_transaction_id URL param)
 // ... other context params as needed
}
```

**Response (POST):**

```json
{
 "actionsToExecute": [
   {
     "type": "everflowClick",
     "scriptSrc": "https://www.c6orlterk.com/scripts/sdk/everflow.js",
     "params": {
       "offer_id": "CAMP_TEST", // Replaced from PARAM:c2
       "affiliate_id": "123", // Replaced from PARAM:c1
       "sub1": "", // Replaced from PARAM:sub1 (defaulted to '')
       // ... other params replaced ...
       "transaction_id": "ABCDEF12345" // Replaced from PARAM:_ef_transaction_id
     }
   }
   // ... other actions
 ]
}
```

**Logic Flow:**

1.  **Fetch Page Rules:** Gets rules from KV key `${siteId}_rule_pageRules`.
   *   Example Value: `[ { "pattern": "/inter", "type": "interstitial" }, ... ]`
2.  **Determine Page Type:** Matches the `url` pathname from the request against `pattern` to find the `pageType`.
3.  **Fetch Affiliate Rules:** Gets rules from KV key `${siteId}_rule_${pageType}AffIdRules` (e.g., `drivebright_rule_interstitialAffIdRules`).
   *   Example Value: `[ { "affId": "nva", "actions": ["drivebright_action_efClick"] }, { "affId": "default", "actions": [] } ]`
4.  **Match Affiliate Rule:** Finds the rule matching the `affid` (Network ID) from the request. Falls back to `default` if no specific match.
5.  **Get Action Keys:** Extracts the list of action keys (e.g., `["drivebright_action_efClick"]`) from the matched rule.
6.  **Fetch Action Definitions:** Gets full action definitions from KV for each key (e.g., key `drivebright_action_efClick`).
   *   Example Value: `{ "type": "everflowClick", "params": { "offer_id": "PARAM:c2", "affiliate_id": "PARAM:c1", ... } }`
7.  **Replace Parameters:** Iterates through the `params` object of each fetched action definition.
   *   If a value starts with `PARAM:`, it extracts the source parameter name (e.g., `c1`, `c2`, `_ef_transaction_id`).
   *   It looks up the corresponding value in the incoming request body (`body.c1`, `body.campid`, `body.ef_transaction_id`, etc.).
   *   It replaces the `PARAM:...` string with the found value (or `''` if the value is missing/null in the request body).
8.  **Return Actions:** Sends the array of processed action definitions (with parameters replaced) back to the frontend.

**KV Structure for Rules/Actions:**

*   `${siteId}_rule_pageRules`: Array of `{ pattern: string, type: string }`
*   `${siteId}_rule_${pageType}AffIdRules`: Array of `{ affId: string, actions: string[] }`
*   `${siteId}_action_${actionName}`: JSON object defining the action (type, scriptSrc, params with `PARAM:` placeholders).
*   `${siteId}_stickyBaseUrl`: String containing the base URL for the Sticky.io API for that site.
*   *(Potentially others for checkout, campaign IDs, etc.)*

**Local KV Population:**

*   Use the `scripts/populate-local-kv.sh` script to load example data into your local KV for testing. Ensure the `wrangler kv key put` commands in the script use the correct syntax.

## Testing

The project includes both unit and end-to-end tests:

### Unit Tests
- Located in `tests/unit/`
- Uses Vitest for testing worker logic
- Configuration in `test/vitest.config.ts`
- Run with: `npm test`

### End-to-End Tests
- Located in `tests/e2e/`
- Uses Playwright for browser automation
- Tests complete user flows including checkout
- Run with: `npx playwright test`

## Memory Bank

The memory-bank/ directory maintains project context and history:

- `productContext.md`: High-level project description and goals
- `activeContext.md`: Current focus and recent changes
- `systemPatterns.md`: Architectural patterns and conventions
- `decisionLog.md`: Key technical decisions and rationale
- `progress.md`: Task completion tracking