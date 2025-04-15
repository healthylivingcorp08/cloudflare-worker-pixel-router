# Phase 2: KV Management UI Implementation Plan (Revised)

## Core Concept: UI-Centric Editing with Hybrid KV Storage

This plan focuses on providing an intuitive UI based on the Site -> Page -> Pixel hierarchy, while leveraging KV for both structural configuration and dynamic values.

## Role-Based Access Control

### User Roles

1.  **Viewer:** View configurations, logs, stats. Read-only access.
2.  **Pixel Manager:** Viewer permissions + Add/Edit/Copy Pixels within pages + Update dynamic pixel-related KV values. Cannot modify API endpoints or site settings.
3.  **Admin:** Full access to all configurations, settings, API endpoints, KV values, and user management.

## Configuration Storage Strategy

1.  **Main Structure (`site_config_{siteId}` KV Key):**
    *   Stores the entire `SiteConfig` JSON object for a given site.
    *   Defines pages, the types of pixels/APIs on each page, and placeholders.
    *   Managed via `GET/PUT /admin/api/config/:siteId`.
    *   Example Placeholder within this JSON: `"offer_id": "{KV:siteA_checkout_offer_id}"`

2.  **Dynamic Values (Separate KV Keys):**
    *   Stores frequently changing values referenced by placeholders in the main config.
    *   Examples: `siteA_checkout_offer_id`, `siteA_checkout_campaign_id`, `stickyio_api_endpoint`.
    *   Managed via `GET/PUT /admin/api/kv/:key` and `GET /admin/api/kv/list`.

3.  **Secrets:** Sensitive data (API Keys) stored as Worker Secrets, referenced via `{SECRET:secret_name}` placeholders. Managed via Cloudflare dashboard/Wrangler.

## UI Workflow & Hierarchy

1.  **Login:** Authenticate via Cloudflare Access. Role determined from JWT.
2.  **Site Selection:** UI lists available sites.
3.  **Page Selection:** User selects a site, UI fetches main config (`GET /admin/api/config/:siteId`) and displays pages.
4.  **Page Editor:** User selects a page. UI displays:
    *   **Pixels Section:** Lists pixels from the `pixels` array in the main config.
        *   *Edit Pixel:* Modify parameters. If a parameter uses `{KV:...}`, UI shows the current value (fetched via `GET /admin/api/kv/:key`) and allows updating it (`PUT /admin/api/kv/:key`). Other parameters are part of the main config JSON.
        *   *Add/Remove/Reorder Pixels:* Modifies the `pixels` array in the UI's state. Saving triggers `PUT /admin/api/config/:siteId` with the entire updated JSON.
    *   **API Endpoints Section:** (Visible/Editable based on role) Lists endpoints from `apiEndpoints` array. Editing modifies the main config JSON.
    *   **Page Settings:** (Visible/Editable based on role)

## Security & Validation

*   Cloudflare Access protects `/admin/*`.
*   API middleware validates JWT and checks roles against required permissions for each endpoint.
*   **Critical Validation for `PUT /admin/api/config/:siteId`:**
    *   If user role is `Pixel Manager`, the API backend *must* compare the submitted JSON with the current version in KV. It **rejects** the request if any changes are detected outside the `pixels` arrays within the `pages` object.
    *   If user role is `Admin`, any valid `SiteConfig` JSON is accepted.

## API Endpoints (Revised)

*   `GET /admin/api/sites`: Lists site IDs. (Viewer+)
*   `GET /admin/api/config/:siteId`: Fetches main `SiteConfig` JSON. (Viewer+)
*   `PUT /admin/api/config/:siteId`: Updates main `SiteConfig` JSON (with role-based validation). (Pixel Manager+/Admin)
*   `GET /admin/api/kv/list?siteId=...`: Lists dynamic value KV keys for the site. (Viewer+)
*   `GET /admin/api/kv/:key`: Gets a specific dynamic value. (Viewer+)
*   `PUT /admin/api/kv/:key`: Updates a specific dynamic value. (Pixel Manager+/Admin, potentially with key prefix restrictions)

## Implementation Phases (Roles Integrated)

### Phase 2.1 - Core UI & RBAC Foundation
*   Cloudflare Access setup with JWT validation & role claims.
*   RBAC middleware implementation.
*   Admin route handling in worker with permission checks.
*   Implement core API endpoints (`GET/PUT config`, `GET/PUT kv`, `GET kv/list`, `GET sites`) with role enforcement.
*   Basic React UI: Site/Page navigation, read-only display of config and KV values. Basic value editing for permitted roles.

### Phase 2.2 - Pixel Management Features
*   Implement UI for adding/removing/reordering pixels within a page (updates main config JSON via API).
*   Implement backend validation for Pixel Manager role on `PUT /admin/api/config/:siteId`.
*   UI enhancements: Search/filtering, better display of pixel parameters.
*   Change history tracking (potentially using KV metadata).

### Phase 2.3 - Advanced Admin & Polish
*   API Endpoint management UI (Admin only).
*   Site settings management UI (Admin only).
*   User permission management interface (Admin only).
*   Bulk operations, Export/Import.
*   Monitoring dashboard, Audit logging.

## Development Steps (Updated Focus)

1.  **Setup Auth & RBAC:** Configure Cloudflare Access, implement JWT validation, create RBAC middleware.
2.  **Core API:** Implement revised API endpoints with role checks. Pay close attention to the validation logic for `PUT /admin/api/config/:siteId`.
3.  **Core UI:** Build React app structure, site/page navigation, display config/KV data based on roles. Implement basic KV value editing.
4.  **Pixel Editing UI:** Implement adding/removing/reordering pixels, triggering updates to the main config JSON.
5.  **Testing:** Thoroughly test API permissions and UI interactions for each role.
6.  **Iterate:** Add features from Phase 2.2 and 2.3 based on priority.

## Next Steps

1.  Confirm this revised plan.
2.  Begin Phase 2.1: Auth, RBAC, Core API, Basic UI.