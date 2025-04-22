// Adjust allowedOrigins for your production frontend URL(s)
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://space-7z6.pages.dev' // Example production frontend origin
  // Add other allowed origins here
];

/**
 * Handles CORS preflight (OPTIONS) requests.
 * Responds with appropriate headers if the origin is allowed.
 */
export function handleOptions(request: Request): Response {
  const origin = request.headers.get('Origin');
  if (origin && allowedOrigins.includes(origin)) {
    // Handle CORS preflight requests.
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE', // Allow common methods
        'Access-Control-Allow-Headers': 'Content-Type, Authorization', // Allow common headers
        'Access-Control-Max-Age': '86400', // Cache preflight response for 1 day
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
   if (origin && allowedOrigins.includes(origin)) {
      // Ensure Vary header is set to Origin to prevent caching issues
      response.headers.set('Vary', 'Origin');
      response.headers.set('Access-Control-Allow-Origin', origin);
   }
   return response;
}