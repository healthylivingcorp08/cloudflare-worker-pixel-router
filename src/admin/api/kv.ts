import { Env } from '../../types';
import { AuthenticatedRequest, KVKeyInfo } from '../types';
import { successResponse, errorResponse, requirePermission } from '../middleware/auth';

/**
 * List all KV keys
 */
export async function handleListKeys(request: AuthenticatedRequest, env: Env): Promise<Response> {
  await requirePermission('view_kv')(request, env);

  try {
    const url = new URL(request.url);
    const siteId = url.searchParams.get('siteId');
    
    // List all keys from the KV namespace
    const keys = await env.PIXEL_CONFIG.list();
    
    // Fetch values for all keys concurrently
    const keyPromises = keys.keys
      .filter(key => !siteId || key.name.startsWith(`${siteId}_`))
      .map(async (key) => {
        const value = await env.PIXEL_CONFIG.get(key.name);
        const parts = key.name.split('_');
        return {
          name: key.name,
          value: value, // Include the value
          site: parts[0],
          type: parts.slice(1, -1).join('_'),
          metadata: key.metadata,
          allowedRoles: key.name.includes('_api_') ? ['admin'] : ['pixel_manager', 'admin']
        };
      });

    const keyInfos = await Promise.all(keyPromises);

    return successResponse(keyInfos);
  } catch (error) {
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
    return errorResponse('Failed to update KV value');
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