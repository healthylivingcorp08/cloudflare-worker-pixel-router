import { Env } from '../../types';
import { 
  AuthenticatedRequest, 
  AdminApiResponse, 
  SiteConfigMetadata, 
  SiteConfig,
  PageConfig
} from '../types';
import { successResponse, errorResponse, requirePermission } from '../middleware/auth';
import siteTemplate from '../../../config/site_template.json'; // Import the template

/**
 * List available sites
 */
export async function handleListSites(request: AuthenticatedRequest, env: Env): Promise<Response> {
  const permissionCheck = await requirePermission('view_config')(request, env);
  if (permissionCheck) return permissionCheck;

  try {
    console.log('[Config] Entering handleListSites (Simplified Logic)'); // <-- Log entry
    // List keys with the site config prefix
    const listResult = await env.PIXEL_CONFIG.list({ prefix: 'site_config_' });
    // Log list result - cursor only exists if list_complete is false
    console.log(`[Config] PIXEL_CONFIG.list({ prefix: 'site_config_' }) result: ${listResult.keys.length} keys, list_complete=${listResult.list_complete}${listResult.list_complete ? '' : `, cursor=${listResult.cursor}`}`); // <-- Log list result

    // Extract site IDs directly from the keys found
    const siteIds = listResult.keys
      .map(key => key.name.substring('site_config_'.length)) // Extract site ID after prefix
      .filter(id => id); // Filter out any potential empty strings (shouldn't happen with prefix)

    const uniqueSiteIds = [...new Set(siteIds)]; // Ensure uniqueness (though prefix should guarantee it)
    console.log(`[Config] Found site IDs directly from 'site_config_' keys: ${uniqueSiteIds.join(', ')}`);

    // No verification needed as the key's existence is the criterion

    console.log(`[Config] Returning success response with found site IDs: ${uniqueSiteIds.join(', ')}`); // <-- Log final result
    return successResponse(uniqueSiteIds);

  } catch (error) {
    console.error('[Config] Error listing sites from KV:', error);
    return errorResponse('Failed to list sites');
  }
}

/**
 * Get site configuration
 */
export async function handleGetSiteConfig(request: AuthenticatedRequest, env: Env, siteId: string): Promise<Response> {
  await requirePermission('view_config')(request, env);

  try {
    const configStr = await env.PIXEL_CONFIG.get(`site_config_${siteId}`);
    if (!configStr) {
      return errorResponse('Site configuration not found', 404);
    }

    const config = JSON.parse(configStr) as SiteConfig;
    return successResponse(config);
  } catch (error) {
    return errorResponse('Failed to get site configuration');
  }
}

/**
 * Update site configuration
 */
export async function handleUpdateSiteConfig(request: AuthenticatedRequest, env: Env, siteId: string): Promise<Response> {
  const role = request.jwt.custom?.role;
  
  try {
    // Parse the new configuration
    const newConfig = await request.json() as SiteConfig;
    
    // Get the current configuration
    const currentConfigStr = await env.PIXEL_CONFIG.get(`site_config_${siteId}`);
    if (!currentConfigStr) {
      return errorResponse('Site configuration not found', 404);
    }
    const currentConfig = JSON.parse(currentConfigStr) as SiteConfig;

    // If user is a pixel_manager, validate they're only changing allowed sections
    if (role === 'pixel_manager') {
      await requirePermission('edit_pixels')(request, env);
      
      // Only allow changes to the pixels arrays within pages
      for (const [pageName, pageConfig] of Object.entries<PageConfig>(newConfig.pages)) {
        if (!currentConfig.pages[pageName]) {
          return errorResponse(`Page ${pageName} cannot be created by pixel managers`);
        }
        
        // Ensure only the pixels array is modified
        const currentPage = currentConfig.pages[pageName];
        if (JSON.stringify(pageConfig.apiEndpoints) !== JSON.stringify(currentPage.apiEndpoints)) {
          return errorResponse('Pixel managers cannot modify API endpoints');
        }
      }
    } else {
      // Admin role required for full configuration changes
      await requirePermission('edit_system_settings')(request, env);
    }

    // Update metadata
    const metadata: SiteConfigMetadata = {
      lastModified: new Date().toISOString(),
      modifiedBy: request.jwt.email,
      version: (currentConfig.metadata?.version || 0) + 1
    };
    newConfig.metadata = metadata;

    // Save the configuration
    await env.PIXEL_CONFIG.put(`site_config_${siteId}`, JSON.stringify(newConfig));

    return successResponse({ success: true });
  } catch (error) {
    console.error(`[Config] Failed to update site configuration for ${siteId}:`, error); // Add detailed logging
    return errorResponse(`Failed to update site configuration: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Create site configuration
 */
export async function handleCreateSiteConfig(request: AuthenticatedRequest, env: Env, siteId: string): Promise<Response> {
  await requirePermission('edit_system_settings')(request, env);

  try {
    // Check if site already exists first
    const existing = await env.PIXEL_CONFIG.get(`site_config_${siteId}`);
    if (existing) {
      return errorResponse('Site configuration already exists', 409);
    }

    // Deep clone the template to avoid modifying the imported object
    const newConfig: SiteConfig = JSON.parse(JSON.stringify(siteTemplate));

    // Replace placeholders in the cloned template
    newConfig.siteId = siteId;
    const now = new Date().toISOString();

    // Recursively replace NEW_SITE_ID and {TIMESTAMP} placeholders
    const replacePlaceholders = (obj: any) => {
      for (const key in obj) {
        if (typeof obj[key] === 'string') {
          obj[key] = obj[key]
            .replace(/NEW_SITE_ID/g, siteId)
            .replace(/{TIMESTAMP}/g, now);
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          replacePlaceholders(obj[key]);
        }
      }
    };

    replacePlaceholders(newConfig);

    // Ensure metadata exists and set specific fields
    if (!newConfig.metadata) {
      newConfig.metadata = { version: 0, lastModified: '', modifiedBy: '' }; // Initialize if missing
    }
    newConfig.metadata.lastModified = now;
    newConfig.metadata.modifiedBy = request.jwt.email; // Set modifier from authenticated user
    newConfig.metadata.version = 1; // Initial version

    // Save the processed configuration
    await env.PIXEL_CONFIG.put(`site_config_${siteId}`, JSON.stringify(newConfig), {
      metadata: { source: 'site_creation', createdBy: request.jwt.email } // Add KV metadata
    });

    // ':enabled' key is no longer needed for listing with the simplified logic

    return successResponse({ success: true });
  } catch (error) {
    console.error(`[Config] Failed to create site configuration for ${siteId}:`, error); // Add detailed logging
    return errorResponse(`Failed to create site configuration: ${error instanceof Error ? error.message : String(error)}`);
  }
}