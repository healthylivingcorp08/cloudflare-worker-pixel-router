<write_file>
<path>docs/refactor_handlePagePixels_plan.md</path>
<content>
# Refactor `handlePagePixels` for Consistent Action Triggering

**Goal:** Modify the `src/handlers/pagePixels.ts` handler (endpoint `/api/page-pixels`) to use the same affiliate-aware, event-driven action triggering logic as `handleCheckout` and `handleUpsell`.

**Current Behavior (`handlePagePixels`):**

1.  Accepts `siteId` and `pageName` query parameters.
2.  Looks up a KV key like `[siteId]_page_[pageName]_pixels`.
3.  The value is expected to be a JSON array of *full pixel definition keys* (e.g., `["siteId_pixel_fbPageView", "siteId_pixel_efClick"]`).
4.  Fetches the raw, unparameterized pixel definitions for those keys.
5.  Returns an array of these raw definitions to the frontend.
6.  **Does not** use `event`, `affid`, scrub status, or the `getActionKeys` helper.
7.  **Does not** parameterize the pixels/scripts.
8.  **Does not** support affiliate-specific rules.

**Desired Behavior:**

1.  Accept `siteId`, `event`, and `affid` query parameters. (`affid` is mandatory based on current `getActionKeys` logic).
2.  Determine scrub status (likely assume `false`/'Normal' for page views).
3.  Call `getActionKeys(siteId, event, isScrub, request, env)` from `src/actions.ts` to get the list of *short action names* based on the specific affiliate key (`[siteId]_[event]_affid_[AFFID_UPPERCASE]_[ScrubStatus]Actions`).
4.  Fetch the action definitions using the short names (e.g., fetch `[siteId]_action_FacebookPageView` based on `action_FacebookPageView`).
5.  Parameterize the `script_template` for any client-side actions using `populateParameters`.
6.  Return a JSON array containing only the *populated, ready-to-inject* client-side HTML script strings.

**Refactoring Steps for `src/handlers/pagePixels.ts`:**

1.  **Update Parameters:**
    *   Modify the function to read `siteId`, `event`, and `affid` from `url.searchParams`.
    *   Validate that all three are present.
    *   Remove the use of `pageName`.

2.  **Determine Scrub Status:**
    *   For simplicity in page view scenarios, assume `isScrub = false`.
    *   ```typescript
      *   const isScrub = false; // Assume Normal status for page views
      *   ```

3.  **Call `getActionKeys`:**
    *   Import `getActionKeys` from `../actions`.
    *   Call it:
    *   ```typescript
      *   import { getActionKeys } from '../actions';
      *   // ... inside handlePagePixels
      *   const actionKeys = await getActionKeys(siteId, event, isScrub, request, env);
      *   if (actionKeys.length === 0) {
      *       console.log(`[PagePixelsHandler] No actions found for site ${siteId}, event ${event}, affid ${affid}`);
      *       // Return empty array
      *       return addCorsHeaders(new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } }), request);
      *   }
      *   ```

4.  **Fetch Action Definitions:**
    *   Map `actionKeys` to full definition keys (`${siteId}_${actionKey}`).
    *   Fetch definitions from `env.PIXEL_CONFIG`.
    *   ```typescript
      *   const actionDefinitionPromises = actionKeys.map(async (actionKey) => {
      *       const definitionKey = `${siteId}_${actionKey}`;
      *       const definitionJson = await env.PIXEL_CONFIG.get(definitionKey);
      *       // ... handle parsing and errors ...
      *       return definitionJson ? JSON.parse(definitionJson) : null;
      *   });
      *   const actionDefinitions = (await Promise.all(actionDefinitionPromises)).filter(def => def !== null);
      *   ```

5.  **Parameterize Client-Side Actions:**
    *   Import `populateParameters` and `DataSources` type from `../utils/parameters`.
    *   Prepare `DataSources`. Since `state` and `confirmationData` aren't readily available for simple page views, use minimal placeholders.
    *   ```typescript
      *   import { populateParameters, DataSources as ParameterDataSources } from '../utils/parameters';
      *   // ... inside handlePagePixels
      *   const clientSideScripts: string[] = [];
      *   const dataSources: ParameterDataSources = {
      *       request: request,
      *       env: env,
      *       state: { siteId: siteId }, // Minimal state, add more if needed/available
      *       confirmationData: {} // Empty object for page views
      *   };
      *
      *   for (const definition of actionDefinitions) {
      *       if (definition?.type === 'client-side' && definition.script_template) {
      *           try {
      *               const populatedScriptResult = await populateParameters(definition.script_template, dataSources);
      *               if (typeof populatedScriptResult === 'string') {
      *                   clientSideScripts.push(populatedScriptResult);
      *               } else {
      *                   console.error(`[PagePixelsHandler] Script population did not return string for key ${siteId}_${definition.provider}`); // Adjust logging key if needed
      *               }
      *           } catch (paramError: any) {
      *               console.error(`[PagePixelsHandler] Parameter population error for ${siteId}_${definition.provider}: ${paramError.message}`); // Adjust logging key if needed
      *           }
      *       }
      *       // Add handling for server-side if needed for page views, though less common
      *   }
      *   ```

6.  **Return Populated Scripts:**
    *   Return the `clientSideScripts` array as a JSON response.
    *   ```typescript
      *   const response = new Response(JSON.stringify(clientSideScripts), {
      *       headers: { 'Content-Type': 'application/json' },
      *       status: 200
      *   });
      *   return addCorsHeaders(response, request);
      *   ```

**Required Frontend Changes:**

*   Update any code calling `/api/page-pixels`.
*   It must now send `siteId`, `event` (e.g., `prelander_view`, `interstitial_view`), and `affid` query parameters.
*   It will receive a JSON array of fully populated HTML script strings.
*   The frontend code needs to take these strings and inject them directly into the page DOM (e.g., using `dangerouslySetInnerHTML` or creating script elements dynamically).

</content>
</write_file>