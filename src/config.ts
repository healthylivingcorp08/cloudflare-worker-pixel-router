import { SiteConfig, SitesConfig, Env, PageConfig, PixelConfig, ApiEndpointConfig } from './types';

/**
 * Map of hostnames to site IDs
 */
const HOST_TO_SITE_MAP: { [hostname: string]: string } = {
  'getamplihear.com': 'siteA',
  'drivebright.com': 'drivebright'
  // Add more mappings as needed
};

/**
 * Type validation functions
 */
function isPixelConfig(obj: any): obj is PixelConfig {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.type === 'string' &&
    obj.config &&
    typeof obj.config === 'object'
  );
}

function isApiEndpointConfig(obj: any): obj is ApiEndpointConfig {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.type === 'string' &&
    typeof obj.endpoint === 'string' &&
    typeof obj.method === 'string' &&
    obj.config &&
    typeof obj.config === 'object'
  );
}

function isPageConfig(obj: any): obj is PageConfig {
  return (
    obj &&
    typeof obj === 'object' &&
    Array.isArray(obj.pixels) &&
    obj.pixels.every(isPixelConfig) &&
    Array.isArray(obj.apiEndpoints) &&
    obj.apiEndpoints.every(isApiEndpointConfig)
  );
}

function isSiteConfig(obj: any): obj is SiteConfig {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.scrubPercent === 'number' &&
    typeof obj.siteId === 'string' &&
    typeof obj.pages === 'object' &&
    Object.values(obj.pages).every(isPageConfig)
  );
}

/**
 * Get the site ID from a hostname
 */
function getSiteIdFromHostname(hostname: string): string {
  // Remove 'www.' if present and convert to lowercase
  const cleanHostname = hostname.replace(/^www\./i, '').toLowerCase();
  
  const siteId = HOST_TO_SITE_MAP[cleanHostname];
  if (!siteId) {
    throw new Error(`No site configuration found for hostname: ${hostname}`);
  }
  
  return siteId;
}

/**
 * Load a site's configuration from KV store
 * Falls back to local JSON file if not in KV
 * @param siteId The site identifier (e.g., 'siteA')
 * @param env Cloudflare Worker environment
 */
async function loadSiteConfig(siteId: string, env: Env): Promise<SiteConfig> {
  // Try to get config from KV first
  const kvKey = `site_config_${siteId}`;
  const kvConfig = await env.PIXEL_CONFIG.get(kvKey);
  
  if (kvConfig) {
    try {
      const config = JSON.parse(kvConfig);
      if (!isSiteConfig(config)) {
        throw new Error(`Invalid configuration format for site: ${siteId}`);
      }
      return config;
    } catch (error) {
      console.error(`Error parsing KV config for ${siteId}:`, error);
    }
  }

  // Fall back to local JSON file
  try {
    const response = await fetch(`/config/sites/${siteId}.json`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const config = await response.json();
    
    if (!isSiteConfig(config)) {
      throw new Error(`Invalid configuration format in JSON file for site: ${siteId}`);
    }
    
    // Cache the config in KV for future use
    await env.PIXEL_CONFIG.put(kvKey, JSON.stringify(config));
    
    return config;
  } catch (error) {
    throw new Error(`Failed to load configuration for site: ${siteId}`);
  }
}

/**
 * Get site configuration based on the request
 * @param request Incoming request
 * @param env Cloudflare Worker environment
 */
export async function getConfigForRequest(request: Request, env: Env): Promise<SiteConfig> {
  const url = new URL(request.url);
  const siteId = getSiteIdFromHostname(url.hostname);
  return await loadSiteConfig(siteId, env);
}

/**
 * Initialize all site configurations in KV store
 * This could be used during deployment or via a cron trigger
 * @param env Cloudflare Worker environment
 */
export async function initializeConfigs(env: Env): Promise<void> {
  for (const [hostname, siteId] of Object.entries(HOST_TO_SITE_MAP)) {
    try {
      const config = await loadSiteConfig(siteId, env);
      const kvKey = `site_config_${siteId}`;
      await env.PIXEL_CONFIG.put(kvKey, JSON.stringify(config));
      console.log(`Initialized config for ${siteId}`);
    } catch (error) {
      console.error(`Failed to initialize config for ${siteId}:`, error);
    }
  }
}

// Export the hostname map for testing/debugging
export { HOST_TO_SITE_MAP };