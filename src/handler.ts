import { Env } from './types';
import { getConfigForRequest } from './config';
import { routePixel, generatePixelHtml } from './router';
import { createResolutionContext } from './resolvers';

interface ApiResponse {
  success?: boolean;
  data?: any;
  error?: string;
}

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  try {
    // Get site configuration based on the request
    const config = await getConfigForRequest(request, env);

    // Create resolution context for placeholders
    const context = createResolutionContext(request, env);

    // Get routing result (pixels and API endpoints)
    const result = await routePixel(config, new URL(request.url).pathname, context);

    // If request is scrubbed, return early with empty response
    if (result.shouldScrub) {
      return new Response('', {
        headers: { 'Content-Type': 'text/html;charset=UTF-8' }
      });
    }

    // Generate HTML for all pixels
    const pixelScripts = result.pixels
      .map(pixel => generatePixelHtml(pixel))
      .join('\n');

    // Prepare API calls if any
    const apiCalls: ApiResponse[] = await Promise.all(
      result.apiEndpoints.map(async endpoint => {
        try {
          const response = await fetch(endpoint.endpoint, {
            method: endpoint.method,
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(endpoint.config)
          });

          if (!response.ok) {
            throw new Error(`API call failed: ${response.statusText}`);
          }

          const data = await response.json();
          return {
            success: true,
            data
          };
        } catch (error) {
          // Properly type the error
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          console.error('API call failed:', errorMessage);
          return {
            success: false,
            error: errorMessage
          };
        }
      })
    );

    // Build the HTML response
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Pixel Router</title>
</head>
<body>
  <!-- Pixel Scripts -->
  ${pixelScripts}

  <!-- API Response Data (for debugging, remove in production) -->
  <script>
    console.log('API Responses:', ${JSON.stringify(apiCalls)});
  </script>
</body>
</html>`;

    // Return the response
    return new Response(html, {
      headers: { 'Content-Type': 'text/html;charset=UTF-8' }
    });

  } catch (error) {
    // Properly type the error
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Request handling failed:', errorMessage);
    
    // Return a generic error response
    return new Response('Internal Server Error', {
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

export default {
  fetch: handleRequest
};