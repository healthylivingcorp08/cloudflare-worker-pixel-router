import { Env } from './types';
import { handleRequest } from './handler';
import { handleAdminRequest } from './admin/router';
import { authenticateRequest } from './admin/middleware/auth';

// Helper function to check if a path is public within the admin scope
function isAdminPublicPath(pathname: string): boolean {
  const publicPaths = [
    '/admin/login',
    '/admin/api/auth/login'
  ];
  return publicPaths.some(path => pathname === path);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      const pathname = url.pathname;
      console.log('[Worker] Request URL:', url.toString());
      console.log('[Worker] Request Path:', pathname);

      // Handle admin routes
      if (pathname.startsWith('/admin')) {
        console.log('[Worker] Admin path detected');

        // If it's a public admin path (login page/API), handle directly
        if (isAdminPublicPath(pathname)) {
          console.log('[Worker] Public admin path, routing directly');
          return handleAdminRequest(request, env);
        }

        // Otherwise, it's a protected admin path, authenticate first
        console.log('[Worker] Protected admin path, authenticating...');
        const authResult = await authenticateRequest(request, env);

        // If authentication failed or redirected, return the response
        if (authResult instanceof Response) {
          console.log('[Worker] Auth failed or redirected');
          return authResult;
        }

        // Handle the admin request with the authenticated request object
        console.log('[Worker] Auth success, handling protected admin request');
        const response = await handleAdminRequest(authResult, env);
        console.log('[Worker] Admin response status:', response.status);
        return response;

      }

      // Handle regular pixel routing requests
      console.log('[Worker] Routing to pixel handler');
      return handleRequest(request, env);
    } catch (error) {
      console.error('[Worker] Global error:', error);
      return new Response('Internal Server Error', {
        status: 500,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
  }
};