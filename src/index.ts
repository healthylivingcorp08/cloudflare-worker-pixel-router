import { Env } from './types'; // Keep Env type import if needed globally or by router
import { ExecutionContext } from '@cloudflare/workers-types';
import { routeRequest } from './router'; // Import the main router

export default {
  /**
   * Main fetch handler for the Cloudflare Worker.
   * Delegates all requests to the central router.
   * @param request - The incoming request.
   * @param env - The environment bindings (KV namespaces, secrets).
   * @param ctx - The execution context.
   * @returns The response generated by the appropriate handler.
   */
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Apply Rate Limiting before routing
    // Using the request pathname as the basis for the rate limiting key.
    // This aligns better with Cloudflare's best practices than using IP directly,
    // as it targets specific resources/paths.
    const { pathname } = new URL(request.url);
    const rateLimitKey = `path:${pathname}`; // Prefixing with 'path:' for clarity

    if (env.API_RATE_LIMITER) {
      const { success } = await env.API_RATE_LIMITER.limit({ key: rateLimitKey });
      if (!success) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again shortly.' }),
          { status: 429, headers: { 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // This case should ideally not happen if wrangler.toml is configured correctly
      // and the binding is present. Log a warning or handle as appropriate.
      // console.warn('API_RATE_LIMITER binding not found in environment. Skipping rate limiting.');
    }

    // Delegate all routing logic to the routeRequest function
    return routeRequest(request, env, ctx);
  },
};

// All previous handler logic, helper functions, type definitions, etc.,
// should now be removed from this file as they have been moved to their
// respective modules (handlers/*, lib/*, middleware/*, utils/*, types.ts, router.ts).