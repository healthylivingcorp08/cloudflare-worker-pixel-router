import { SiteConfig, Env, PageConfig, PixelConfig, ApiEndpointConfig } from './types';

/**
 * Map of hostnames to site IDs
 */
const HOST_TO_SITE_MAP: { [hostname: string]: string } = {
  'getamplihear.com': 'siteA',
  'drivebright.com': 'drivebright'
  // Add more mappings as needed
};

/**
 * Map of Sticky.io URL identifiers to base URLs
 */
export const STICKY_URL_MAP: Record<string, string> = {
  '1': 'https://techcommerceunlimited.sticky.io/api/v1', // drivebright
  '2': 'URL_FOR_CODE_CLOUDS_PLACEHOLDER', // TODO: Replace with actual URL
  '3': 'URL_FOR_X_PLACEHOLDER',         // TODO: Replace with actual URL
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
async function loadSiteConfig(siteId: string, env: Env): Promise<SiteConfig> {
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
      scrubPercent: scrubPercent,
      pages: pages
    };

    // Optional: Validate the constructed object if needed (isSiteConfig might need adjustment)
    // if (!isSiteConfig(siteConfig)) {
    //    throw new Error(`Constructed SiteConfig is invalid for site: ${siteId}`);
    // }

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