import { Env } from './types';
import { handleRequest } from './handler';
import { handleAdminRequest } from './admin/router';
import { authenticateRequest } from './admin/middleware/auth';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      console.log('[Worker] Request URL:', url.toString());
      console.log('[Worker] Request Path:', url.pathname);

      // Handle admin routes
      if (url.pathname.startsWith('/admin')) {
        console.log('[Worker] Routing to admin handler');
        try {
          // Authenticate the request
          const authResult = await authenticateRequest(request, env);
          
          // If authentication failed, return the error response
          if (authResult instanceof Response) {
            console.log('[Worker] Auth failed');
            return authResult;
          }

          // Handle the admin request with the authenticated request object
          console.log('[Worker] Auth success, handling admin request');
          const response = await handleAdminRequest(authResult, env);
          console.log('[Worker] Admin response status:', response.status);
          return response;
        } catch (error) {
          console.error('[Worker] Admin handler error:', error);
          return new Response('Admin Error', {
            status: 500,
            headers: { 'Content-Type': 'text/plain' }
          });
        }
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