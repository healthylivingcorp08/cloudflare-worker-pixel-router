# Cloudflare Worker Pixel Router

A Cloudflare Worker that routes conversion pixels/postbacks based on configurable scrub percentages per site.

## Features

- Accepts POST requests with order/conversion data.
- Determines the site and retrieves scrub % and pixel/postback URLs from a static config.
- Routes each conversion to the correct pixel/postback based on the scrub %.
- Fires the appropriate pixel/postback (HTTP request) from the Worker.
- Returns a response indicating which pixel was fired.
- (Optional) Logs which conversions went to which pixel for auditability (stubbed).

## File Structure

```
cloudflare-worker-pixel-router/
│
├── src/
│   ├── handler.ts      # Main Worker request handler (entry point)
│   ├── router.ts       # Routing logic (scrub % decision)
│   ├── config.ts       # Config loading (from static JSON)
│   ├── pixel.ts        # Pixel/postback firing logic
│   ├── types.ts        # TypeScript types/interfaces
│   └── logger.ts       # (Optional) Logging/audit logic
│
├── config/
│   └── sites.json      # Static config: scrub %, pixel URLs per site
│
├── wrangler.toml       # Cloudflare Worker config
├── package.json
├── tsconfig.json
└── README.md
```

## Setup

1. **Install dependencies:**
   ```bash
   cd cloudflare-worker-pixel-router
   npm install
   ```

2. **Edit `config/sites.json`** to add or modify site configurations.

## Development

- **Start local dev server:**
  ```bash
  npm run dev
  ```

- **Build TypeScript:**
  ```bash
  npm run build
  ```

## Deployment

- **Publish to Cloudflare Workers:**
  ```bash
  npm run deploy
  ```

## Usage

- **POST** conversion data to the Worker endpoint:
  ```
  POST / (application/json)
  {
    "site": "siteA",
    "orderId": "12345",
    "amount": 100,
    ...
  }
  ```

- **Response:**
  ```json
  {
    "pixelType": "normal",
    "pixelUrl": "https://example.com/pixelA",
    "fired": true
  }
  ```

## Notes

- The logger is a stub for auditability and can be extended for real logging.
- The config is static for MVP; future versions may support dynamic config sources.