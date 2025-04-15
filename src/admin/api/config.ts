import { Env } from '../../types';
import { 
  AuthenticatedRequest, 
  AdminApiResponse, 
  SiteConfigMetadata, 
  SiteConfig,
  PageConfig
} from '../types';
import { successResponse, errorResponse, requirePermission } from '../middleware/auth';

/**
 * List available sites
 */
export async function handleListSites(request: AuthenticatedRequest, env: Env): Promise<Response> {
  await requirePermission('view_config')(request, env);
  
  try {
    // For now, return the sites from the sites.json config
    const sites = ['siteA']; // This will be expanded later
    return successResponse(sites);
  } catch (error) {
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
    return errorResponse('Failed to update site configuration');
  }
}

/**
 * Create site configuration
 */
export async function handleCreateSiteConfig(request: AuthenticatedRequest, env: Env, siteId: string): Promise<Response> {
  await requirePermission('edit_system_settings')(request, env);

  try {
    const config = await request.json() as SiteConfig;
    
    // Check if site already exists
    const existing = await env.PIXEL_CONFIG.get(`site_config_${siteId}`);
    if (existing) {
      return errorResponse('Site configuration already exists', 409);
    }

    // Add metadata
    const metadata: SiteConfigMetadata = {
      lastModified: new Date().toISOString(),
      modifiedBy: request.jwt.email,
      version: 1
    };
    config.metadata = metadata;

    // Save the configuration
    await env.PIXEL_CONFIG.put(`site_config_${siteId}`, JSON.stringify(config));

    return successResponse({ success: true });
  } catch (error) {
    return errorResponse('Failed to create site configuration');
  }
}