import { Env } from '../../types';
import { AuthenticatedRequest, KVKeyInfo } from '../types';
import { successResponse, errorResponse, requirePermission, jsonResponse } from '../middleware/auth';

// --- Embedded Action Templates ---
const actionFbPurchaseTemplate = JSON.stringify({
  "type": "server-side",
  "provider": "facebook_capi",
  "event_name": "Purchase",
  "url": "https://graph.facebook.com/v19.0/PARAM:FB_PIXEL_ID/events?access_token=PARAM:FB_ACCESS_TOKEN",
  "method": "POST",
  "headers": { "Content-Type": "application/json" },
  "body_template": {
    "data": [{
      "event_name": "Purchase",
      "event_time": "PARAM:TIMESTAMP_UNIX",
      "action_source": "website",
      "user_data": {
        "em": ["PARAM:USER_EMAIL"],
        "ph": ["PARAM:USER_PHONE"],
        "client_ip_address": "PARAM:IP_ADDRESS",
        "client_user_agent": "PARAM:USER_AGENT",
        "fbc": "PARAM:FBC",
        "fbp": "PARAM:FBP"
      },
      "custom_data": {
        "currency": "USD",
        "value": "PARAM:ORDER_TOTAL",
        "order_id": "PARAM:ORDER_ID",
        "content_ids": ["PARAM:PRODUCT_SKU"],
        "content_type": "product"
      },
      "event_source_url": "PARAM:PAGE_URL"
    }],
    "test_event_code": "PARAM:FB_TEST_CODE"
  }
});

const actionGaPurchaseTemplate = JSON.stringify({
  "type": "client-side",
  "provider": "google_analytics_ga4",
  "script_template": "gtag('event', 'purchase', { transaction_id: 'PARAM:ORDER_ID', value: PARAM:ORDER_TOTAL, currency: 'USD', items: [{ item_id: 'PARAM:PRODUCT_SKU', item_name: 'PARAM:PRODUCT_NAME', price: PARAM:PRODUCT_PRICE, quantity: PARAM:PRODUCT_QUANTITY }] });"
});

const actionEfPostbackTemplate = JSON.stringify({
  "type": "server-side",
  "provider": "everflow_postback",
  "url": "https://www.c6orlterk.com/?nid=1318&transaction_id=PARAM:CLICK_ID", // Default NID, adjust if needed
  "method": "GET"
});

// Renamed from actionEfPixelTemplate to actionEfClickPixelTemplate
const actionEfClickPixelTemplate = JSON.stringify({
  "type": "client-side",
  "provider": "everflow",
  "script_template": "<script type=\"text/javascript\" src=\"https://www.c6orlterk.com/scripts/sdk/everflow.js\"></script><script type=\"text/javascript\">EF.click({ offer_id: EF.urlParameter('c2'), affiliate_id: EF.urlParameter('c1'), sub1: EF.urlParameter('sub1'), sub2: EF.urlParameter('sub2'), sub3: EF.urlParameter('sub3'), sub4: EF.urlParameter('sub4'), sub5: EF.urlParameter('sub5'), uid: EF.urlParameter('uid'), source_id: EF.urlParameter('source_id'), transaction_id: EF.urlParameter('_ef_transaction_id') });</script>"
});

// --- Default KV Entries for a New Site ---
// Based on kv_pixel_fires_checkout_plan.md structure
const defaultSiteKvEntries = {
  // Scrub Rules & Campaign IDs
  "global_scrub_percent": "10", // Default 10%
  "normal_campaign_id": "4",    // Default normal campaign ID (Checkout)
  "scrub_campaign_id": "5",     // Default scrub campaign ID (Checkout)

  // Payout Rules
  "payout_steps": "1", // Default to initial checkout only

  // Action Lists (Defaulting to include common actions)
  "checkoutNormalActions": JSON.stringify([
    "action_FacebookPurchase",
    "action_GoogleAnalyticsPurchase",
    "action_EverflowPostback"
    // Removed action_EverflowConversionPixel as click tracking usually isn't on checkout
  ]),
  "upsell1NormalActions": JSON.stringify([ // Example: Only FB and Postback for upsell 1
    "action_FacebookUpsell", // Assuming an upsell version exists or is created later
    "action_EverflowPostback"
  ]),
   "upsell2NormalActions": JSON.stringify([ // Example: Only FB and Postback for upsell 2
    "action_FacebookUpsell",
    "action_EverflowPostback"
  ]),
  // Optional: Add ScrubAction lists if needed, otherwise they use NormalActions

  // Action Definitions (Using embedded templates)
  "action_FacebookPurchase": actionFbPurchaseTemplate,
  "action_GoogleAnalyticsPurchase": actionGaPurchaseTemplate,
  "action_EverflowPostback": actionEfPostbackTemplate,
  "action_EverflowClickPixel": actionEfClickPixelTemplate, // Added Click Pixel
  // Add other default actions here (e.g., action_FacebookUpsell) if templates are available
  // "action_FacebookUpsell": "{}", // Placeholder for FB Upsell action template

  // Placeholder for site status (can be managed separately)
  "website_status": "active", // Default status

  // --- Example/Documentation Keys ---
  "example_affiliate_override_action_list": "To override actions for a specific affiliate, create a key using the format: [siteId]_[eventName]_affid_[AFFID_UPPERCASE]_[ScrubStatus]Actions. Example Key: yoursite_checkout_affid_MYAFFILIATE_NormalActions. The value must be a JSON array of action definition keys, e.g., [\"action_FacebookPurchase\", \"action_EverflowPostback\"]. NOTE: The 'affid' URL parameter is REQUIRED for any actions to fire."
};

/**
 * List all KV keys
 */
export async function handleListKeys(request: AuthenticatedRequest, env: Env): Promise<Response> {
  const permissionCheckList = await requirePermission('view_kv')(request, env);
  if (permissionCheckList) return permissionCheckList; // Return 403 if permission denied

  try {
    const url = new URL(request.url);
    const siteIdsParam = url.searchParams.get('siteIds'); // Expect comma-separated string: "site1,site2"
    const searchTerm = url.searchParams.get('search')?.toLowerCase(); // Get search term and convert to lower case
    const statusFilter = url.searchParams.get('status'); // Get status filter

    // List all keys from the KV namespace
    console.log(`[KV] Listing keys for siteIds: ${siteIdsParam || 'all'}, search: ${searchTerm || 'none'}, status: ${statusFilter || 'none'}`);
    // TODO: Implement pagination if key count exceeds KV list limits (e.g., 1000)
    const listResult = await env.PIXEL_CONFIG.list();
    const allKeys = listResult.keys; // Assuming list() gets all keys; adjust if pagination needed for large sets
    console.log('[KV] Found', allKeys.length, 'total keys');

    let keysToProcess = allKeys;
    let siteIdArray: string[] = [];

    // --- Filtering Logic ---

    // 1. Filter by Site IDs if provided
    if (siteIdsParam) {
      siteIdArray = siteIdsParam.split(',').map(id => id.trim()).filter(id => id.length > 0);
      if (siteIdArray.length > 0) {
        keysToProcess = keysToProcess.filter(key => {
          const keySiteId = key.name.split('_')[0]; // Use underscore
          return siteIdArray.includes(keySiteId);
        });
        console.log(`[KV] Filtered by siteIds [${siteIdArray.join(', ')}]: ${keysToProcess.length} keys remaining.`);
      } else {
         console.log(`[KV] siteIds parameter provided but empty after trimming. No site filter applied.`);
      }
    }
    // 2. Filter by Status if provided (and no siteIds filter applied)
    else if (statusFilter) {
      console.log(`[KV] Applying status filter: '${statusFilter}' (No siteIds provided)`);
      // Find all siteIds matching the status
      const statusKeys = allKeys.filter(key => key.name.endsWith('_website_status'));
      const matchingSiteIds = new Set<string>();

      // Fetch values only for the status keys to determine matches
      const statusPromises = statusKeys.map(async (statusKey) => {
        const value = await env.PIXEL_CONFIG.get(statusKey.name);
        if (value === statusFilter) {
          const keySiteId = statusKey.name.split('_')[0]; // Use underscore
          matchingSiteIds.add(keySiteId);
        }
      });
      await Promise.all(statusPromises);
      console.log(`[KV] Found ${matchingSiteIds.size} sites matching status '${statusFilter}'.`);

      // Filter the main key list to include only keys from matching sites
      keysToProcess = keysToProcess.filter(key => {
        const keySiteId = key.name.split('_')[0]; // Use underscore
        return matchingSiteIds.has(keySiteId);
      });
      console.log(`[KV] Filtered by status: ${keysToProcess.length} keys remaining.`);
    }

    // 3. Filter by Search Term (applied AFTER siteId or status filter)
    if (searchTerm) {
      keysToProcess = keysToProcess.filter(key => {
        // Check if the key name (e.g., "siteId_keyName") contains the search term (case-insensitive)
        return key.name.toLowerCase().includes(searchTerm);
      });
      console.log(`[KV] Filtered by search term '${searchTerm}': ${keysToProcess.length} keys remaining.`);
    }

    console.log(`[KV] Final count before fetching values: ${keysToProcess.length} keys.`);

    // Fetch values for the final filtered keys
    const keyPromises = keysToProcess.map(async (key) => {
        const value = await env.PIXEL_CONFIG.get(key.name);
        const parts = key.name.split('_'); // Split by underscore
        const site = parts[0];
        const type = parts.slice(1).join('_'); // Re-join if type itself contains underscores
        return {
          name: key.name,
          value: value, // Include the value
          site: site,
          type: type, // The part after the first '_'
          // metadata: key.metadata, // Standard KV types don't include metadata in list results
          // Adjust role logic if needed based on new naming convention
          allowedRoles: key.name.includes('_api_') ? ['admin'] : ['pixel_manager', 'admin'] // Example logic
        };
      });

    const keyInfos = await Promise.all(keyPromises);

    console.log('[KV] Found keys:', keyInfos);
    const response = successResponse(keyInfos);
    console.log('[KV] Response:', response.status);
    return response;
  } catch (error) {
    console.error('[KV] Error listing keys:', error);
    return errorResponse('Failed to list KV keys');
  }
}

/**
 * Get a KV value
 */
export async function handleGetValue(request: AuthenticatedRequest, env: Env, key: string): Promise<Response> {
  await requirePermission('view_kv')(request, env);

  try {
    const value = await env.PIXEL_CONFIG.get(key);
    if (value === null) {
      return errorResponse('Key not found', 404);
    }

    // const metadata = await env.PIXEL_CONFIG.getWithMetadata(key); // getWithMetadata doesn't exist on standard KVNamespace
    return successResponse({
      key,
      value,
      // metadata: metadata.metadata // Metadata not available via standard get
    });
  } catch (error) {
    return errorResponse('Failed to get KV value');
  }
}

/**
 * Update a KV value
 */
export async function handleUpdateValue(request: AuthenticatedRequest, env: Env, key: string): Promise<Response> {
  // Check permission based on key type
  const permission = key.includes('_api_') ? 'edit_system_settings' : 'edit_pixel_kv';
  await requirePermission(permission)(request, env);

  try {
    const { value, metadata } = await request.json() as { value: string; metadata?: any };
    
    // Validate value
    if (typeof value !== 'string') {
      return errorResponse('Value must be a string');
    }

    // Update metadata with change tracking
    const updatedMetadata = {
      ...metadata,
      lastModified: new Date().toISOString(),
      modifiedBy: request.jwt.email
    };

    // Save to KV
    await env.PIXEL_CONFIG.put(key, value /*, { metadata: updatedMetadata } */); // Standard put doesn't accept metadata options

    return successResponse({ success: true });
  } catch (error) {
    console.error(`[KV] Failed to update KV value for key "${key}":`, error); // Add detailed logging
    return errorResponse(`Failed to update KV value: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Delete a KV value
 */
export async function handleDeleteValue(request: AuthenticatedRequest, env: Env, key: string): Promise<Response> {
  // Only admins can delete KV values
  await requirePermission('edit_system_settings')(request, env);

  try {
    await env.PIXEL_CONFIG.delete(key);
    return successResponse({ success: true });
  } catch (error) {
    return errorResponse('Failed to delete KV value');
  }
}

/**
 * Bulk update KV values
 */
export async function handleBulkUpdate(request: AuthenticatedRequest, env: Env): Promise<Response> {
  // Check basic permission
  await requirePermission('edit_pixel_kv')(request, env);

  try {
    const updates = await request.json() as Array<{ key: string; value: string; metadata?: any }>;
    
    // Validate all updates first
    for (const update of updates) {
      // Check permission based on key type
      const permission = update.key.includes('_api_') ? 'edit_system_settings' : 'edit_pixel_kv';
      const permissionCheck = await requirePermission(permission)(request, env);
      if (permissionCheck !== null) {
        return errorResponse(`Insufficient permission for key: ${update.key}`);
      }
    }

    // Perform updates
    await Promise.all(updates.map(async ({ key, value, metadata }) => {
      const updatedMetadata = {
        ...metadata,
        lastModified: new Date().toISOString(),
        modifiedBy: request.jwt.email
      };
      await env.PIXEL_CONFIG.put(key, value /*, { metadata: updatedMetadata } */); // Standard put doesn't accept metadata options
    }));

    return successResponse({ success: true });
  } catch (error) {
    return errorResponse('Failed to perform bulk update');
  }
}

/**
 * Create a new KV value
 */
export async function handleCreateValue(request: AuthenticatedRequest, env: Env): Promise<Response> {
  // Check permission based on key type (assume edit_pixel_kv unless it's clearly system)
  // More robust logic might be needed depending on key naming conventions
  await requirePermission('edit_pixel_kv')(request, env); // Default permission

  try {
    const { key, value, metadata } = await request.json() as { key: string; value: string; metadata?: any };

    if (!key || typeof key !== 'string' || key.trim() === '') {
      return errorResponse('Key is required and must be a non-empty string');
    }
    if (typeof value !== 'string') {
      return errorResponse('Value must be a string');
    }

    // Check if key already exists (optional, but good practice)
    const existingValue = await env.PIXEL_CONFIG.get(key);
    if (existingValue !== null) {
      return errorResponse(`Key "${key}" already exists. Use PUT to update.`, 409); // 409 Conflict
    }

    // Update metadata with creation tracking
    const createdMetadata = {
      ...metadata,
      createdAt: new Date().toISOString(),
      createdBy: request.jwt.email,
      lastModified: new Date().toISOString(),
      modifiedBy: request.jwt.email
    };

    // Save to KV
    await env.PIXEL_CONFIG.put(key, value /*, { metadata: createdMetadata } */); // Standard put doesn't accept metadata options

    // Use jsonResponse directly to set 201 status
    return jsonResponse({ success: true, key: key }, 201);
  } catch (error: any) {
    console.error('[KV] Error creating value:', error);
    return errorResponse(`Failed to create KV value: ${error.message || 'Unknown error'}`); // Default 400 status
  }
}

/**
 * Bulk delete KV values
 */
export async function handleBulkDelete(request: AuthenticatedRequest, env: Env): Promise<Response> {
  // Only admins can bulk delete KV values
  await requirePermission('edit_system_settings')(request, env);

  try {
    // Expect keys and siteIds in the request body
    const { keys, siteIds } = await request.json() as { keys: string[], siteIds: string[] };

    if (!Array.isArray(keys) || keys.length === 0) {
      return errorResponse('Keys must be provided as a non-empty array');
    }
    if (!Array.isArray(siteIds) || siteIds.length === 0) {
      return errorResponse('siteIds must be provided as a non-empty array');
    }

    // Perform deletions across all specified sites and keys
    let deletedCount = 0;
    const errors: string[] = [];
    const totalRequestedDeletions = keys.length * siteIds.length;

    console.log(`[KV Bulk Delete] Attempting to delete ${keys.length} keys across ${siteIds.length} sites. Total operations: ${totalRequestedDeletions}`);

    for (const siteId of siteIds) {
      if (typeof siteId !== 'string' || siteId.trim() === '') {
        errors.push(`Invalid siteId found: "${siteId}". Skipping.`);
        continue; // Skip this siteId
      }
      const trimmedSiteId = siteId.trim(); // Use trimmed siteId

      for (const keySuffix of keys) {
        if (typeof keySuffix !== 'string' || keySuffix.trim() === '') {
            errors.push(`Invalid key suffix found for site "${trimmedSiteId}": "${keySuffix}". Skipping.`);
            continue; // Skip this key suffix
        }
        const trimmedKeySuffix = keySuffix.trim(); // Use trimmed key suffix
        const fullKey = `${trimmedSiteId}_${trimmedKeySuffix}`; // Construct the full key

        try {
          // Permission check already done for the whole operation (admin only)
          await env.PIXEL_CONFIG.delete(fullKey);
          // Note: delete doesn't throw if the key doesn't exist.
          // We might want to check existence first if we only want to count actual deletions.
          // For simplicity, we count attempts here. Consider adding a check if needed.
          deletedCount++;
          console.log(`[KV Bulk Delete] Deleted (or attempted): ${fullKey}`);
        } catch (deleteError: any) {
          const errorMessage = `Failed to delete key "${fullKey}": ${deleteError.message || 'Unknown error'}`;
          console.error(`[KV Bulk Delete] ${errorMessage}`);
          errors.push(errorMessage);
        }
      }
    }

    if (errors.length > 0) {
      // Partial success or complete failure - Use jsonResponse for 207 status and custom payload
      const finalMessage = `Bulk delete completed with ${errors.length} errors out of ${totalRequestedDeletions} requested operations.`;
      console.warn(`[KV Bulk Delete] ${finalMessage}`);
      return jsonResponse({
        success: false, // Indicate overall operation had issues
        message: finalMessage,
        error: errors.join('; '),
        deletedCount: deletedCount, // This counts successful attempts/non-errors
        totalRequested: totalRequestedDeletions
      }, 207); // 207 Multi-Status
    }

    // Full success - Use standard successResponse (status 200)
    console.log(`[KV Bulk Delete] Successfully completed ${deletedCount} delete operations.`);
    return successResponse({ success: true, deletedCount }); // deletedCount here represents successful operations

  } catch (error: any) {
    console.error('[KV] Error performing bulk delete:', error);
    // Handle JSON parsing errors specifically
    if (error instanceof SyntaxError) {
        return errorResponse('Invalid JSON body provided. Expected { "keys": ["key1", ...], "siteIds": ["site1", ...] }');
    }
    return errorResponse(`Failed to perform bulk delete: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Create KV entries for a new site based on a template
 */
export async function handleCreateSiteFromTemplate(request: AuthenticatedRequest, env: Env): Promise<Response> {
  // Requires permission to create/edit KV values
  const permissionCheckCreate = await requirePermission('edit_system_settings')(request, env); // Changed to require admin permission
  if (permissionCheckCreate) return permissionCheckCreate; // Return 403 if permission denied

  try {
    const { siteId } = await request.json() as { siteId: string };

    if (!siteId || typeof siteId !== 'string' || siteId.trim() === '') {
      return errorResponse('siteId is required and must be a non-empty string');
    }

    const createdKeys: string[] = [];
    const skippedKeys: string[] = [];
    const errors: string[] = [];

    // Iterate through the new defaultSiteKvEntries template
    for (const [templateKey, defaultValue] of Object.entries(defaultSiteKvEntries)) {
      const fullKey = `${siteId}_${templateKey}`; // Use '_' as separator
      try {
        // Check if key already exists to avoid accidental overwrites by this function
        const existingValue = await env.PIXEL_CONFIG.get(fullKey);
        if (existingValue !== null) {
          skippedKeys.push(fullKey);
          continue; // Skip if key already exists
        }

        // Prepare metadata
        const metadata = {
          createdAt: new Date().toISOString(),
          createdBy: request.jwt.email,
          lastModified: new Date().toISOString(),
          modifiedBy: request.jwt.email,
          source: 'template_creation'
        };

        // Create the KV entry
        // Ensure the value is a string (simple values are already strings, JSON needs stringify)
        const valueToPut = typeof defaultValue === 'string' ? defaultValue : JSON.stringify(defaultValue);
        await env.PIXEL_CONFIG.put(fullKey, valueToPut /*, { metadata } */); // Standard put doesn't accept metadata options
        createdKeys.push(fullKey);

      } catch (error: any) {
        console.error(`[KV Template] Error creating key ${fullKey}:`, error);
        errors.push(`Failed to create key "${fullKey}": ${error.message || 'Unknown error'}`);
      }
    }

    if (errors.length > 0) {
      // Use 207 Multi-Status if there were errors
      return jsonResponse({
        success: false,
        message: `Template creation for site "${siteId}" completed with errors.`,
        createdKeys,
        skippedKeys,
        errors
      }, 207);
    }

    // Use 201 Created if successful (or partially successful with skips but no errors)
    return jsonResponse({
      success: true,
      message: `Template creation for site "${siteId}" completed.`,
      createdKeys,
      skippedKeys
    }, 201);

  } catch (error: any) {
    console.error('[KV Template] Error processing template creation:', error);
    // Handle JSON parsing errors or other unexpected issues
    if (error instanceof SyntaxError) {
        return errorResponse('Invalid JSON body provided. Expected { "siteId": "your-site-name" }');
    }
    return errorResponse(`Failed to create site from template: ${error.message || 'Unknown error'}`);
  }
}
 
/**
 * Delete an entire site by removing all associated KV keys.
 */
export async function handleDeleteSite(request: AuthenticatedRequest, env: Env, siteId: string): Promise<Response> {
  // Only admins can delete entire sites
  const permissionCheck = await requirePermission('edit_system_settings')(request, env);
  if (permissionCheck) return permissionCheck; // Return 403 if permission denied
 
  if (!siteId || typeof siteId !== 'string' || siteId.trim() === '') {
    return errorResponse('siteId is required and must be a non-empty string in the path.', 400);
  }
 
  console.log(`[KV] Attempting to delete site: ${siteId}`);
 
  try {
    // First check if site exists by looking for a known key pattern, e.g., status
    const siteStatusKey = `${siteId}_website_status`;
    const siteStatus = await env.PIXEL_CONFIG.get(siteStatusKey);
    if (siteStatus === null) {
        // Optionally check another key if status might not exist yet
        const siteScrubKey = `${siteId}_global_scrub_percent`;
        const siteScrub = await env.PIXEL_CONFIG.get(siteScrubKey);
        if (siteScrub === null) {
            console.log(`[KV Delete Site] Site "${siteId}" not found (checked ${siteStatusKey} and ${siteScrubKey})`);
            return new Response(`Site "${siteId}" not found`, { status: 404 });
        }
    }
    
    console.log(`[KV Delete Site] Found site config, proceeding with deletion`);
 
    const keysToDelete: string[] = [];
    let cursor: string | undefined = undefined;
    let listComplete = false;
 
    // Loop to handle pagination when listing keys
    while (!listComplete) {
      // Define an interface for the expected list result structure to provide explicit types
      interface KVListResultWithCursor {
          keys: { name: string }[];
          list_complete: boolean;
          cursor?: string;
      }
      // Cast to any to bypass potentially incorrect type definitions for list() options/result, then cast to our interface
      const listResult: KVListResultWithCursor = await (env.PIXEL_CONFIG as any).list({ prefix: `${siteId}_`, cursor: cursor }); // Use underscore prefix
      // Add explicit type for key
      listResult.keys.forEach((key: { name: string }) => keysToDelete.push(key.name));
      listComplete = listResult.list_complete;
      // Use optional chaining and check list_complete before accessing cursor
      cursor = !listComplete ? listResult.cursor : undefined;
      console.log(`[KV Delete Site] Listed ${listResult.keys.length} keys, list_complete: ${listComplete}, cursor: ${cursor ? 'present' : 'none'}`);
    }
 
    // Note: No separate site_config_{siteId} key assumed with the new structure

    if (keysToDelete.length === 0) {
      console.log(`[KV Delete Site] No KV keys found for site "${siteId}" with prefix "${siteId}_"`);
      // Return 404 Not Found as no keys matching the pattern exist
      return new Response(`No KV keys found for site "${siteId}"`, { status: 404 });
    }
 
    console.log(`[KV Delete Site] Found ${keysToDelete.length} keys to delete for site "${siteId}".`);
 
    // Perform deletions
    // Note: env.PIXEL_CONFIG.delete() does not support bulk delete directly.
    // We need to iterate and delete one by one.
    let deletedCount = 0;
    const errors: string[] = [];
 
    // Consider batching deletes if performance becomes an issue, but simple iteration is fine for now.
    for (const key of keysToDelete) {
      try {
        await env.PIXEL_CONFIG.delete(key);
        deletedCount++;
      } catch (deleteError: any) {
        console.error(`[KV Delete Site] Failed to delete key "${key}":`, deleteError);
        errors.push(`Failed to delete key "${key}": ${deleteError.message || 'Unknown error'}`);
      }
    }
 
    if (errors.length > 0) {
      // Partial success or complete failure - Use jsonResponse for 207 status and custom payload
      console.error(`[KV Delete Site] Completed deletion for site "${siteId}" with ${errors.length} errors.`);
      return jsonResponse({
        success: false, // Indicate overall operation had issues
        message: `Site deletion for "${siteId}" completed with errors.`,
        error: errors.join('; '),
        deletedCount: deletedCount,
        totalKeysFound: keysToDelete.length
      }, 207); // 207 Multi-Status
    }
 
    // Full success
    console.log(`[KV Delete Site] Successfully deleted ${deletedCount} keys for site "${siteId}".`);
    // Return 204 No Content on successful deletion of all site keys
    return new Response(null, { status: 204 });
 
  } catch (error: any) {
    console.error(`[KV Delete Site] Error deleting site "${siteId}":`, error);
    return errorResponse(`Failed to delete site: ${error.message || 'Unknown error'}`);
  }
}