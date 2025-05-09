import { SiteConfig, Env, PageConfig, PixelConfig, ApiEndpointConfig } from './types';
import { getCache, setCache } from './utils/cache';

/**
 * Map of hostnames to site IDs, i don't think i use this anymore might delete 
 */
const HOST_TO_SITE_MAP: { [hostname: string]: string } = {
  'getamplihear.com': 'siteA',
  'drivebright.com': 'drivebright'
  // Add more mappings as needed
};

/**
 * Map of Sticky.io URL identifiers to base URLs
 */
interface StickyInstanceConfig {
  url: string;
  username_secret_name: string; // Name of the env variable for the username
  password_secret_name: string; // Name of the env variable for the password
}

export const STICKY_CONFIG_MAP: Record<string, StickyInstanceConfig> = {
  '1': {
    url: 'https://techcommerceunlimited.sticky.io/api/v1',
    // This should be the NAME of the variable in .dev.vars (or Cloudflare secret) that holds the USERNAME
    // e.g., if .dev.vars has DRIVEBRIGHT_USER="actual_user", then this should be 'DRIVEBRIGHT_USER'
    username_secret_name: 'STICKY_USERNAME', // Assuming 'STICKY_USERNAME' is the var name in your .dev.vars
    // This should be the NAME of the variable in .dev.vars (or Cloudflare secret) that holds the PASSWORD
    // e.g., if .dev.vars has DRIVEBRIGHT_PASS="actual_pass", then this should be 'DRIVEBRIGHT_PASS'
    password_secret_name: 'STICKY_PASSWORD'  // Assuming 'STICKY_PASSWORD' is the var name in your .dev.vars
  }, // drivebright
  '2': {
    url: 'URL_FOR_CODE_CLOUDS_PLACEHOLDER',
    username_secret_name: 'CODE_CLOUDS_USERNAME_ENV_VAR_NAME', // Replace with actual env var name
    password_secret_name: 'CODE_CLOUDS_PASSWORD_ENV_VAR_NAME'  // Replace with actual env var name
  }, // TODO: Replace
  '3': {
    url: 'URL_FOR_X_PLACEHOLDER',
    username_secret_name: 'X_USERNAME_ENV_VAR_NAME', // Replace with actual env var name
    password_secret_name: 'X_PASSWORD_ENV_VAR_NAME'  // Replace with actual env var name
  }, // TODO: Replace
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
 * Load a site's configuration from granular KV store keys
 * @param siteId The site identifier (e.g., 'drivebright')
 * @param env Cloudflare Worker environment
 */
export async function loadSiteConfig(siteId: string, env: Env): Promise<SiteConfig> {
  const cacheKey = `siteConfig_${siteId}`;
  const cachedConfig = getCache<SiteConfig>(cacheKey);

  if (cachedConfig) {
    console.log(`Cache hit for site config: ${siteId}`);
    return cachedConfig;
  }

  console.log(`Cache miss for site config: ${siteId}. Fetching from KV.`);
  try {
    // Define keys based on the granular structure
    const scrubPercentKey = `${siteId}_rule_scrubPercent`;
    const pageRulesKey = `${siteId}_rule_pageRules`;
    const domainKey = `${siteId}_domain`;

    // Fetch values concurrently
    const [scrubPercentStr, pageRulesStr, domainStr] = await Promise.all([
      env.PIXEL_CONFIG.get(scrubPercentKey),
      env.PIXEL_CONFIG.get(pageRulesKey),
      env.PIXEL_CONFIG.get(domainKey)
    ]);

    // Validate domain
    if (domainStr === null) {
      throw new Error(`Domain config not found for site: ${siteId}`);
    }

    // Validate scrubPercent
    if (scrubPercentStr === null) {
      throw new Error(`KV key not found: ${scrubPercentKey}`);
    }
    const scrubPercent = parseInt(scrubPercentStr, 10);
    if (isNaN(scrubPercent)) {
      throw new Error(`Invalid number format for ${scrubPercentKey}: ${scrubPercentStr}`);
    }

    // Validate and parse pageRules
    if (pageRulesStr === null) {
      throw new Error(`KV key not found: ${pageRulesKey}`);
    }
    let pages: { [pageName: string]: PageConfig };
    try {
      pages = JSON.parse(pageRulesStr);
      // Optional: Add validation for the pages object structure if needed
      // e.g., check if it's an object and its values conform to PageConfig
      if (typeof pages !== 'object' || pages === null) {
        throw new Error('Parsed pageRules is not a valid object.');
      }
      // Deeper validation using isPageConfig could be added here if necessary
      // Object.values(pages).forEach((pageConf, index) => {
      //   if (!isPageConfig(pageConf)) {
      //     throw new Error(`Invalid PageConfig structure for page at index ${index}`);
      //   }
      // });

    } catch (parseError: any) {
      throw new Error(`Error parsing JSON for ${pageRulesKey}: ${parseError.message}`);
    }

    // Construct the SiteConfig object
    const siteConfig: SiteConfig = {
      siteId: siteId, // Add siteId to the config object
      domain: domainStr,
      // scrubPercent: scrubPercent, // Removed to align with SiteConfig type definition
      pages: pages
    };

    // Optional: Validate the constructed object if needed (isSiteConfig might need adjustment)
    // if (!isSiteConfig(siteConfig)) {
    //    throw new Error(`Constructed SiteConfig is invalid for site: ${siteId}`);
    // }

    // Store in cache with a 60-second TTL
    setCache(cacheKey, siteConfig, 60);
    console.log(`Cached site config for: ${siteId}`);

    return siteConfig;

  } catch (error: any) {
    console.error(`Failed to load configuration for site ${siteId} from granular KV keys:`, error.message);
    // Re-throw or handle appropriately
    throw new Error(`Failed to load configuration for site: ${siteId}. Reason: ${error.message}`);
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
// export async function initializeConfigs(env: Env): Promise<void> {
//   // This function's logic is likely incompatible with the granular key structure
//   // and needs to be re-evaluated or removed.
//   console.warn("initializeConfigs function is commented out due to incompatibility with granular KV structure.");
//   // for (const [hostname, siteId] of Object.entries(HOST_TO_SITE_MAP)) {
//   //   try {
//   //     // Logic to read granular keys and potentially write a single key? Or just validate?
//   //     // const config = await loadSiteConfig(siteId, env); // This now reads granular
//   //     // const kvKey = `site_config_${siteId}`; // Writing this key is likely not desired now
//   //     // await env.PIXEL_CONFIG.put(kvKey, JSON.stringify(config));
//   //     console.log(`Config check/initialization logic needed for ${siteId} with granular keys.`);
//   //   } catch (error) {
//   //     console.error(`Failed to initialize/check config for ${siteId}:`, error);
//   //   }
//   // }
// }

// Export the hostname map for testing/debugging
export { HOST_TO_SITE_MAP };