import { Env } from '../types';
import { ExecutionContext } from '@cloudflare/workers-types';
import { addCorsHeaders } from '../middleware/cors';

/**
 * Handles POST requests to /api/page-pixels.
 * Fetches pixel configurations associated with a specific site and page name (derived from URL) from KV.
 */
export async function handlePagePixels(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  try {
    // Read data from POST body
    const body = await request.json() as { siteId?: string; url?: string; [key: string]: any };
    const siteId = body.siteId;
    const requestUrl = body.url;

    if (!siteId || !requestUrl) {
      // Return CORS headers even for errors
      return addCorsHeaders(new Response('Missing siteId or url in request body', { status: 400 }), request);
    }

    // Determine pageName from the URL path
    let pageName = 'unknown';
    try {
        const parsedUrl = new URL(requestUrl);
        // Basic logic: use the last part of the path, or 'home' for root
        const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);
        pageName = pathSegments.pop() || 'home';
        // TODO: Add more robust page name mapping logic if needed (e.g., based on specific paths)
    } catch (e) {
        console.error(`[PagePixelsHandler] Invalid URL provided in body: ${requestUrl}`, e);
        return addCorsHeaders(new Response('Invalid URL provided in request body', { status: 400 }), request);
    }


    console.log(`[PagePixelsHandler] Fetching pixels for siteId: ${siteId}, derived page: ${pageName} (from URL: ${requestUrl})`);

    // Fetch the pixel configuration keys for the specific page
    const pagePixelKeysKey = `${siteId}_page_${pageName}_pixels`; // e.g., drivebright_page_presell_pixels
    const pixelKeysJson = await env.PIXEL_CONFIG.get(pagePixelKeysKey);

    if (!pixelKeysJson) {
      console.warn(`[PagePixelsHandler] No pixel configuration found for ${pagePixelKeysKey}`);
      return addCorsHeaders(new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } }), request); // Return empty array
    }

    let pixelKeys: string[] = [];
    try {
      pixelKeys = JSON.parse(pixelKeysJson);
      if (!Array.isArray(pixelKeys)) {
        throw new Error('Pixel keys configuration is not an array');
      }
    } catch (e) {
      console.error(`[PagePixelsHandler] Failed to parse pixel keys JSON for ${pagePixelKeysKey}: ${e instanceof Error ? e.message : String(e)}`, pixelKeysJson);
      // Return CORS headers even for errors
      return addCorsHeaders(new Response('Error parsing pixel configuration', { status: 500 }), request);
    }

    // Fetch the full definition for each pixel key
    const pixelDefinitionPromises = pixelKeys.map(async (key) => {
      const pixelJson = await env.PIXEL_CONFIG.get(key); // e.g., drivebright_pixel_fbPageView
      if (pixelJson) {
        try {
          const pixelDefinition = JSON.parse(pixelJson);
          // Placeholder: Parameter resolution might be needed here for dynamic pixels
          // For now, return the raw definition. Frontend might handle resolution.
          return pixelDefinition;
        } catch (e) {
          console.error(`[PagePixelsHandler] Failed to parse pixel definition for key ${key}: ${e instanceof Error ? e.message : String(e)}`, pixelJson);
          return null; // Skip this pixel on error
        }
      } else {
        console.warn(`[PagePixelsHandler] Pixel definition not found in KV for key ${key}`);
        return null; // Skip this pixel if not found
      }
    });

    const pixelDefinitions = (await Promise.all(pixelDefinitionPromises)).filter(def => def !== null); // Filter out nulls from errors/not found

    const response = new Response(JSON.stringify(pixelDefinitions), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });
    return addCorsHeaders(response, request); // Add CORS headers

  } catch (error: any) {
    console.error('[PagePixelsHandler] Error fetching page pixels:', error);
    // Return CORS headers even for errors
    return addCorsHeaders(new Response(`Error fetching page pixels: ${error.message}`, { status: 500 }), request);
  }
}