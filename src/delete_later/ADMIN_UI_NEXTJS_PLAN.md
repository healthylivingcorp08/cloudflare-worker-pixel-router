# Admin UI Next.js Enhancement Plan

This plan outlines the tasks required to enhance the admin UI located in `src/admin/ui-next/src/app`.

## Tasks

-   [x] **Bug Fix:** Investigate and fix the issue where the UI doesn't visually update values after a successful update operation.
-   [x] **Feature:** Add a "Delete Site" button and implement its functionality. (Verified existing implementation)
-   [x] **Feature:** Implement a search feature to allow searching by key across all sites. (Verified existing implementation)
-   [x] **Feature:** Implement a filter feature to allow filtering sites by `website_status`.
-   [ ] **Feature:** Implement functionality to select multiple sites at once.
-   [ ] **Feature:** Enhance the "Create New Site" button to automatically create default KV pair settings based on `config/site_template.json`.

## Progress Tracking

*(This section will be updated as tasks are completed)*

- **2025-04-20:** Fixed UI refresh bug. Root cause: Incorrect URL construction in `EditKVDialog.tsx` caused backend update failure despite success response. Corrected URL format.
- **2025-04-20:** Verified "Delete Site" functionality. Feature was already implemented in `DeleteSiteDialog.tsx`, `page.tsx`, `router.ts`, and `kv.ts`.
- **2025-04-20:** Verified "Search by Key" functionality. Feature was already implemented in the frontend (`page.tsx`) and backend (`kv.ts` handler for `GET /admin/api/kv`).
- **2025-04-20:** Implemented "Filter by Status" feature. Added dropdown to `page.tsx`, updated `KVTable.tsx` to pass status param, modified `kv.ts` handler to filter by `website_status`.