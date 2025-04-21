import { Env } from '../../types';
import { AuthenticatedRequest, KVKeyInfo } from '../types';
import { successResponse, errorResponse, requirePermission, jsonResponse } from '../middleware/auth';

// Embed the template content
const siteTemplate = {
  "enabled": "true",
  "scrub_percentage": "70",
  "default_pixel_id": "fb_default",
  "default_conversion_api_token": ""
};

/**
 * List all KV keys
 */
export async function handleListKeys(request: AuthenticatedRequest, env: Env): Promise<Response> {
  const permissionCheckList = await requirePermission('view_kv')(request, env);
  if (permissionCheckList) return permissionCheckList; // Return 403 if permission denied

  try {
    const url = new URL(request.url);
    const siteId = url.searchParams.get('siteId');
    const searchTerm = url.searchParams.get('search')?.toLowerCase(); // Get search term and convert to lower case
    const statusFilter = url.searchParams.get('status'); // Get status filter

    // List all keys from the KV namespace
    console.log(`[KV] Listing keys for siteId: ${siteId || 'all'}, search: ${searchTerm || 'none'}, status: ${statusFilter || 'none'}`);
    // TODO: Implement pagination if key count exceeds KV list limits (e.g., 1000)
    const listResult = await env.PIXEL_CONFIG.list();
    const allKeys = listResult.keys; // Assuming list() gets all keys; adjust if pagination needed for large sets
    console.log('[KV] Found', allKeys.length, 'total keys');

    let keysToProcess = allKeys;

    // --- Filtering Logic ---

    // 1. Filter by Site ID if provided (overrides status filter)
    if (siteId) {
      keysToProcess = keysToProcess.filter(key => key.name.startsWith(`${siteId}:`));
      console.log(`[KV] Filtered by siteId '${siteId}': ${keysToProcess.length} keys remaining.`);
    }
    // 2. Filter by Status if provided (and no siteId filter)
    else if (statusFilter) {
      console.log(`[KV] Applying status filter: '${statusFilter}'`);
      // Find all siteIds matching the status
      const statusKeys = allKeys.filter(key => key.name.endsWith(':website_status'));
      const matchingSiteIds = new Set<string>();

      // Fetch values only for the status keys to determine matches
      const statusPromises = statusKeys.map(async (statusKey) => {
        const value = await env.PIXEL_CONFIG.get(statusKey.name);
        if (value === statusFilter) {
          const keySiteId = statusKey.name.split(':')[0];
          matchingSiteIds.add(keySiteId);
        }
      });
      await Promise.all(statusPromises);
      console.log(`[KV] Found ${matchingSiteIds.size} sites matching status '${statusFilter}'.`);

      // Filter the main key list to include only keys from matching sites
      keysToProcess = keysToProcess.filter(key => {
        const keySiteId = key.name.split(':')[0];
        return matchingSiteIds.has(keySiteId);
      });
      console.log(`[KV] Filtered by status: ${keysToProcess.length} keys remaining.`);
    }

    // 3. Filter by Search Term (applied after siteId or status filter)
    if (searchTerm) {
      keysToProcess = keysToProcess.filter(key => {
        // Check if the key name (e.g., "siteId:keyName") contains the search term (case-insensitive)
        return key.name.toLowerCase().includes(searchTerm);
      });
      console.log(`[KV] Filtered by search term '${searchTerm}': ${keysToProcess.length} keys remaining.`);
    }

    console.log(`[KV] Final count before fetching values: ${keysToProcess.length} keys.`);

    // Fetch values for the final filtered keys
    const keyPromises = keysToProcess.map(async (key) => {
        const value = await env.PIXEL_CONFIG.get(key.name);
        const parts = key.name.split(':'); // Split by ':'
        const site = parts[0];
        const type = parts.slice(1).join(':'); // Re-join if type itself contains ':'
        return {
          name: key.name,
          value: value, // Include the value
          site: site,
          type: type, // The part after the first ':'
          metadata: key.metadata,
          // Adjust role logic if needed based on new naming convention
          allowedRoles: key.name.includes(':api_') ? ['admin'] : ['pixel_manager', 'admin']
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

    const metadata = await env.PIXEL_CONFIG.getWithMetadata(key);
    return successResponse({
      key,
      value,
      metadata: metadata.metadata
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
    await env.PIXEL_CONFIG.put(key, value, { metadata: updatedMetadata });

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
      await env.PIXEL_CONFIG.put(key, value, { metadata: updatedMetadata });
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
    await env.PIXEL_CONFIG.put(key, value, { metadata: createdMetadata });

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
    const { keys } = await request.json() as { keys: string[] };

    if (!Array.isArray(keys) || keys.length === 0) {
      return errorResponse('Keys must be provided as a non-empty array');
    }

    // Perform deletions
    // Note: env.PIXEL_CONFIG.delete() does not support bulk delete directly.
    // We need to iterate and delete one by one.
    let deletedCount = 0;
    const errors: string[] = [];

    for (const key of keys) {
      try {
        // Double-check permission for each key just in case (though bulk is admin only here)
        // const permission = key.includes('_api_') ? 'edit_system_settings' : 'edit_pixel_kv';
        // const permissionCheck = await requirePermission(permission)(request, env);
        // if (permissionCheck !== null) {
        //   errors.push(`Insufficient permission for key: ${key}`);
        //   continue;
        // }
        await env.PIXEL_CONFIG.delete(key);
        deletedCount++;
      } catch (deleteError: any) {
        errors.push(`Failed to delete key "${key}": ${deleteError.message || 'Unknown error'}`);
      }
    }

    if (errors.length > 0) {
      // Partial success or complete failure - Use jsonResponse for 207 status and custom payload
      return jsonResponse({
        success: false, // Indicate overall operation had issues
        error: `Bulk delete completed with errors: ${errors.join('; ')}`,
        deletedCount: deletedCount,
        totalRequested: keys.length
      }, 207); // 207 Multi-Status
    }

    // Full success - Use standard successResponse (status 200)
    return successResponse({ success: true, deletedCount });

  } catch (error: any) {
    console.error('[KV] Error performing bulk delete:', error);
    return errorResponse(`Failed to perform bulk delete: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Create KV entries for a new site based on a template
 */
export async function handleCreateSiteFromTemplate(request: AuthenticatedRequest, env: Env): Promise<Response> {
  // Requires permission to create/edit KV values
  const permissionCheckCreate = await requirePermission('edit_pixel_kv')(request, env);
  if (permissionCheckCreate) return permissionCheckCreate; // Return 403 if permission denied

  try {
    const { siteId } = await request.json() as { siteId: string };

    if (!siteId || typeof siteId !== 'string' || siteId.trim() === '') {
      return errorResponse('siteId is required and must be a non-empty string');
    }

    const createdKeys: string[] = [];
    const skippedKeys: string[] = [];
    const errors: string[] = [];

    for (const [templateKey, defaultValue] of Object.entries(siteTemplate)) {
      const fullKey = `${siteId}:${templateKey}`; // Use ':' as separator
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
        await env.PIXEL_CONFIG.put(fullKey, defaultValue, { metadata });
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
    // First check if site exists by looking for site config key
    const siteConfig = await env.PIXEL_CONFIG.get(`site_config_${siteId}`);
    if (!siteConfig) {
      console.log(`[KV Delete Site] Site "${siteId}" not found (checked site_config_${siteId})`);
      return new Response(`Site "${siteId}" not found`, { status: 404 });
    }
    
    console.log(`[KV Delete Site] Found site config, proceeding with deletion`);
 
    const keysToDelete: string[] = [];
    let cursor: string | undefined = undefined;
    let listComplete = false;
 
    // Loop to handle pagination when listing keys
    while (!listComplete) {
      // Add explicit type for listResult based on Cloudflare KV types
      const listResult: KVNamespaceListResult<unknown> = await env.PIXEL_CONFIG.list({ prefix: `${siteId}:`, cursor: cursor });
      // Add explicit type for key
      listResult.keys.forEach((key: KVNamespaceListKey<unknown>) => keysToDelete.push(key.name));
      listComplete = listResult.list_complete;
      // Conditionally access cursor only when list is not complete
      cursor = listComplete ? undefined : (listResult as any).cursor;
      console.log(`[KV Delete Site] Listed ${listResult.keys.length} keys, list_complete: ${listComplete}, cursor: ${cursor ? 'present' : 'none'}`);
    }
 
    // Also include the site config key in deletion
    keysToDelete.push(`site_config_${siteId}`);
 
    if (keysToDelete.length === 1) { // Only the site config key
      console.log(`[KV Delete Site] No content keys found for site "${siteId}" (only config exists)`);
      // Return 410 Gone since the site exists but has no content
      return new Response(null, { status: 410 });
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
    return new Response(null, { status: 410 }); // 410 Gone indicates the resource was intentionally deleted
 
  } catch (error: any) {
    console.error(`[KV Delete Site] Error deleting site "${siteId}":`, error);
    return errorResponse(`Failed to delete site: ${error.message || 'Unknown error'}`);
  }
}