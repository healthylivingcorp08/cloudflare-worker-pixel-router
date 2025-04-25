// Adjust allowedOrigins for your production frontend URL(s)
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://*.space-7z6.pages.dev', // Allow any subdomain for Cloudflare Pages previews/prod
  'http://127.0.0.1:8787', // Wrangler dev server origin
  'http://localhost:3001' // Drivebright local dev origin
];

/**
 * Checks if a given origin is allowed based on the allowedOrigins list,
 * supporting exact matches and a specific wildcard pattern 'https://*.domain.tld'.
 */
function isOriginAllowed(origin: string | null, allowed: string[]): boolean {
  if (!origin) {
    return false; // No origin header present
  }

  for (const allowedOrigin of allowed) {
    if (allowedOrigin.startsWith('https://*.')) {
      // Handle wildcard subdomain pattern
      const domainPart = allowedOrigin.substring('https://*.'.length);
      if (origin.startsWith('https://') && origin.endsWith('.' + domainPart)) {
        // Check if the part before the domain is a valid subdomain (simple check)
        const subdomain = origin.substring('https://'.length, origin.length - ('.' + domainPart).length);
        // Ensure subdomain is not empty and doesn't contain invalid characters like '/'
        if (subdomain && !subdomain.includes('/')) {
           return true;
        }
      }
    } else {
      // Handle exact match
      if (origin === allowedOrigin) {
        return true;
      }
    }
  }

  return false; // Origin not found in allowed list or pattern
}


/**
 * Handles CORS preflight (OPTIONS) requests.
 * Responds with appropriate headers if the origin is allowed.
 */
export function handleOptions(request: Request): Response {
  const origin = request.headers.get('Origin');
  if (isOriginAllowed(origin, allowedOrigins)) {
    // Handle CORS preflight requests.
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': origin!, // Assert origin is non-null here
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
        // Allow standard headers plus custom ones used by the client
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Internal-Transaction-Id, X-Target-Campaign-Id',
        'Access-Control-Max-Age': '86400',
      },
    });
  } else {
    // Handle standard OPTIONS request or disallowed origin.
    // Respond with 403 Forbidden if origin is present but not allowed
    if (origin) {
        return new Response('Origin not allowed', { status: 403 });
    }
    // Respond with standard Allow header if no origin (e.g., direct OPTIONS request)
    return new Response(null, {
      headers: {
        Allow: 'POST, GET, OPTIONS, PUT, DELETE',
      },
    });
  }
}

/**
 * Adds the 'Access-Control-Allow-Origin' header to a Response
 * if the request's origin is in the allowed list.
 */
export function addCorsHeaders(response: Response, request: Request): Response {
   const origin = request.headers.get('Origin');
    if (isOriginAllowed(origin, allowedOrigins)) {
       // Ensure Vary header is set to Origin to prevent caching issues
       response.headers.set('Vary', 'Origin');
       response.headers.set('Access-Control-Allow-Origin', origin!); // Assert origin is non-null here
       // Also add Allow-Headers to the actual response for good measure, though primarily for preflight
       response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Internal-Transaction-Id, X-Target-Campaign-Id');
      // If the client needs to READ headers from the response, use Expose-Headers
      // response.headers.set('Access-Control-Expose-Headers', '...');
   }
   return response;
}