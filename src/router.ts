import { SiteConfig, PageConfig, PixelRouteResult, ResolutionContext } from './types';
import { resolvePlaceholders } from './resolvers';

/**
 * Extract the page name from the URL path
 * @param path URL path (e.g., "/checkout/", "/upsell1/")
 */
function getPageFromPath(path: string): string {
  // Remove leading and trailing slashes, get the first segment
  const cleanPath = path.replace(/^\/|\/$/g, '');
  const segments = cleanPath.split('/');
  return segments[0] || 'landing'; // Default to landing if no path
}

/**
 * Determine if this request should be scrubbed based on site's scrub percentage
 * @param config Site configuration
 * @returns boolean indicating if the request should be scrubbed
 */
function shouldScrubRequest(config: SiteConfig): boolean {
  const rand = Math.random() * 100;
  return rand < config.scrubPercent;
}

/**
 * Route the request to appropriate pixels and API endpoints based on site/page config
 * @param config Site configuration
 * @param path Request path
 * @param context Resolution context for placeholders
 */
export async function routePixel(
  config: SiteConfig,
  path: string,
  context: ResolutionContext
): Promise<PixelRouteResult> {
  // Determine which page we're on
  const pageName = getPageFromPath(path);
  
  // Get page config
  const pageConfig = config.pages[pageName];
  if (!pageConfig) {
    throw new Error(`No configuration found for page: ${pageName}`);
  }

  // Determine if this request should be scrubbed
  const shouldScrub = shouldScrubRequest(config);

  // If we're scrubbing, return empty arrays for pixels and endpoints
  if (shouldScrub) {
    return {
      pixels: [],
      apiEndpoints: [],
      shouldScrub: true
    };
  }

  // Resolve all placeholders in the configuration
  const resolvedConfig = await resolvePlaceholders<PageConfig>(pageConfig, context);

  return {
    pixels: resolvedConfig.pixels,
    apiEndpoints: resolvedConfig.apiEndpoints,
    shouldScrub: false
  };
}

/**
 * Generate HTML for a pixel based on its configuration
 * @param pixel Resolved pixel configuration
 */
export function generatePixelHtml(pixel: any): string {
  switch (pixel.type) {
    case 'everflow_click':
      return `
<script type="text/javascript" src="https://www.c6orlterk.com/scripts/sdk/everflow.js"></script>
<script type="text/javascript">
EF.click({
    offer_id: '${pixel.config.offer_id}',
    affiliate_id: '${pixel.config.affiliate_id}'${
      Object.entries(pixel.config.parameterMapping || {})
        .map(([key, value]) => `,\n    ${key}: '${value}'`)
        .join('')
    }
});
</script>`;

    case 'everflow_conversion':
      return `
<script type="text/javascript" src="https://www.c6orlterk.com/scripts/sdk/everflow.js"></script>
<script type="text/javascript">
EF.conversion({
    offer_id: ${pixel.config.offer_id}
});
</script>`;

    default:
      throw new Error(`Unknown pixel type: ${pixel.type}`);
  }
}