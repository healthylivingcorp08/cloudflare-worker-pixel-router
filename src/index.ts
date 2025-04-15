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
  // Check for exact match or match with trailing slash
  return publicPaths.some(path => pathname === path || pathname === path + '/');
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      const pathname = url.pathname;
      console.log('[Worker] Request URL:', url.toString());
      console.log('[Worker] Request Path:', pathname);

      // Handle admin routes
      if (pathname === '/admin' || pathname === '/admin/' || isAdminPublicPath(pathname)) {
        // Only handle /admin, /admin/, /admin/login, /admin/api/*
        console.log('[Worker] Public or base admin path, routing directly to admin handler');
        return handleAdminRequest(request, env);
      }
      if (pathname.startsWith('/admin/api/')) {
        // Authenticate and handle protected admin API routes
        console.log('[Worker] Protected admin API path, authenticating...');
        const authResult = await authenticateRequest(request, env);
        if (authResult instanceof Response) {
          console.log('[Worker] Auth failed or redirected for API');
          return authResult;
        }
        console.log('[Worker] Auth success, handling protected admin API request');
        const response = await handleAdminRequest(authResult, env);
        console.log('[Worker] Admin API response status:', response.status);
        return response;
      }
      // Let Wrangler serve all other static assets (including /admin/ui/*)

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