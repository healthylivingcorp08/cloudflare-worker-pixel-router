import { Env } from './types';
import { ExecutionContext } from '@cloudflare/workers-types';
import { handleOptions, addCorsHeaders } from './middleware/cors'; // Import CORS handlers

// Import API Handlers
import { handleCheckout } from './handlers/checkout';
import { handleUpsell } from './handlers/upsell';
import { handlePagePixels } from './handlers/pagePixels';
import { handleOrderDetails } from './handlers/orderDetails';
import { handleDecideCampaign } from './handlers/decideCampaign';
import { handlePaypalReturn } from './handlers/paypalReturn'; // Added PayPal return handler

/**
 * Main request router for the Cloudflare Worker.
 * Delegates requests to specific handlers based on path and method.
 */
export async function routeRequest(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method;

    console.log(`[Router] Received ${method} request for ${pathname}`);

    // --- DEBUG: Log all incoming headers for /api/upsell ---
    if (pathname === '/api/upsell' && method === 'POST') {
        console.log('[Router] DEBUG: Inside /api/upsell header log block.');
        console.log(`[Router] DEBUG: Origin header: ${request.headers.get('Origin')}`); // Log Origin header
        const headersObject: Record<string, string> = {};
        request.headers.forEach((value, key) => {
            headersObject[key] = value;
        });
        console.log('[Router] Incoming headers for /api/upsell:', JSON.stringify(headersObject));
    }
    // --- END DEBUG ---

    try {
        // --- Handle OPTIONS requests for CORS preflight ---
        const apiOptionsPaths = [
            '/', // For checkout
            '/api/checkout', // Explicit checkout path (if used)
            '/api/upsell',
            '/api/page-pixels',
            '/api/order-details',
            '/api/decide-campaign',
            '/checkout/paypal-return' // Added PayPal return path for CORS
        ];
        if (method === 'OPTIONS' && (apiOptionsPaths.includes(pathname) || pathname.startsWith('/admin'))) {
            console.log(`[Router] Handling OPTIONS for ${pathname}`);
            return handleOptions(request); // Use the dedicated OPTIONS handler
        }

        // --- Handle Admin Routes ---
        // Delegate /, /admin, and /login paths to the admin router/proxy
        // --- Proxy Next.js Dev Server Assets ---
        // In local dev (wrangler dev), proxy requests for /_next/ to the Next.js dev server
        // TODO: Determine if NEXT_PUBLIC_APP_URL is reliable or if we should hardcode localhost:3000 for dev proxy
        const nextDevServerUrl = 'http://localhost:3000'; // Assuming Next.js runs on 3000 locally
        if (pathname.startsWith('/_next/')) {
            const proxyUrl = `${nextDevServerUrl}${pathname}${url.search}`;
            console.log(`[Router] DEV PROXY: Proxying Next.js asset request for ${pathname} to ${proxyUrl}`);
            try {
                // Re-create the request to the target server
                const proxyRequest = new Request(proxyUrl, {
                    method: request.method,
                    headers: request.headers,
                    body: request.body,
                    redirect: 'manual', // Important to handle redirects manually if needed
                });
                const proxyResponse = await fetch(proxyRequest);
                console.log(`[Router] DEV PROXY: Received response from Next.js for ${proxyUrl}: Status ${proxyResponse.status}`);
                // Return the response directly
                return proxyResponse;
            } catch (error: any) {
                 console.error(`[Router] DEV PROXY: Error proxying request to ${proxyUrl}:`, error);
                 return new Response(`Error proxying request to Next.js dev server: ${error.message}`, { status: 502 }); // Bad Gateway
            }
        }

        // --- Handle API Routes ---
        if (pathname === '/' && method === 'POST') {
            console.log(`[Router] Routing to Checkout Handler`);
            return await handleCheckout(request, env, ctx);
        }
        else if (pathname === '/api/decide-campaign' && method === 'POST') {
            console.log(`[Router] Routing to Decide Campaign Handler`);
            return await handleDecideCampaign(request, env, ctx);
        }
        else if (pathname === '/api/order-details' && method === 'POST') {
            console.log(`[Router] Routing to Order Details Handler`);
            return await handleOrderDetails(request, env, ctx);
        }
        else if (pathname === '/api/upsell' && method === 'POST') {
            console.log(`[Router] Routing to Upsell Handler`);
            return await handleUpsell(request, env, ctx);
        }
        else if (pathname === '/api/page-pixels' && method === 'POST') { // Changed method to POST
            console.log(`[Router] Routing to Page Pixels Handler`);
            return await handlePagePixels(request, env, ctx);
        }
        else if (pathname === '/checkout/paypal-return' && method === 'GET') {
            console.log(`[Router] Routing to PayPal Return Handler`);
            return await handlePaypalReturn(request, env, ctx);
        }

        // --- Fallback for unhandled routes ---
        console.log(`[Router] No route matched for ${method} ${pathname}`);
        const notFoundResponse = new Response('Not Found', { status: 404 });
        // Add CORS headers even to 404s if the origin is allowed, helps debugging frontend issues
        return addCorsHeaders(notFoundResponse, request);

    } catch (error: any) {
        console.error(`[Router] Uncaught error processing ${method} ${pathname}:`, error);
        // Generic error response with CORS
        const errorResponse = new Response(JSON.stringify({ message: `Internal Server Error: ${error.message}` }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
        return addCorsHeaders(errorResponse, request);
    }
}