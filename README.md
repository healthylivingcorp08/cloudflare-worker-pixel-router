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
# Update a value
npx wrangler kv:key put --binding=PIXEL_CONFIG siteA_checkout_offer_id "746"
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