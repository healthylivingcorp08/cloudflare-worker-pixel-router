import { getSiteConfig } from './config';
import { routePixel } from './router';
import { firePixel, fireStickyOrder } from './pixel';
import { logConversion } from './logger';
import { ConversionData, PixelRouteResult, Env } from './types';

interface StickyEnv extends Env {
  STICKY_USERNAME: string;
  STICKY_PASSWORD: string;
}

export default {
  async fetch(request: Request, env: StickyEnv): Promise<Response> {
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
      // Fire Sticky.io "New Order" API (do not block on result)
      // Only for test transactions (e.g., if data.test === true)
      if (data.test === true) {
        const stickyOrderPayload = {
          // Minimal required fields for Sticky.io test order
          firstName: "Test",
          lastName: "User",
          billingFirstName: "Test",
          billingLastName: "User",
          billingAddress1: "123 Test St",
          billingCity: "Testville",
          billingState: "TX",
          billingZip: "12345",
          billingCountry: "US",
          phone: "5555555555",
          email: "test@sticky.io",
          creditCardType: "VISA",
          creditCardNumber: "5555555555555555",
          expirationDate: "0628",
          CVV: "123",
          shippingId: "2",
          tranType: "Sale",
          ipAddress: "127.0.0.1",
          campaignId: "539",
          offers: [
            {
              offer_id: "8",
              product_id: "4",
              billing_model_id: "6",
              quantity: "1"
            }
          ]
        };
        fireStickyOrder(
          stickyOrderPayload,
          env.STICKY_USERNAME,
          env.STICKY_PASSWORD
        );
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