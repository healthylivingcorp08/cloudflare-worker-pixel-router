import { getSiteConfig } from './config';
import { routePixel } from './router';
import { firePixel } from './pixel';
import { logConversion } from './logger';
import { ConversionData, PixelRouteResult, Env } from './types';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405 });
    }

    let data: ConversionData;
    try {
      data = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
    }

    const site = data.site;
    if (!site) {
      return new Response(JSON.stringify({ error: 'Missing site field' }), { status: 400 });
    }

    const siteConfig = await getSiteConfig(site, env);
    if (!siteConfig) {
      return new Response(JSON.stringify({ error: 'Unknown site' }), { status: 404 });
    }

    const { pixelType, pixelUrl } = routePixel(siteConfig);
    let fired = false;

    if (pixelType === 'normal') {
      // Fire normal pixel
      fired = await firePixel(siteConfig.normalPixelUrl, data);
      // Fire postbackUrl if present (do not block on result)
      if (siteConfig.postbackUrl) {
        firePixel(siteConfig.postbackUrl, data);
      }
    } else if (pixelType === 'scrub') {
      // Fire only scrub pixel
      fired = await firePixel(siteConfig.scrubPixelUrl, data);
    }

    // Optionally log the conversion
    logConversion(data, pixelType);

    const result: PixelRouteResult = {
      pixelType,
      pixelUrl,
      fired,
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  },
};