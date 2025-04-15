import { Env } from './types';
import { handleRequest } from './handler';
import { handleAdminRequest } from './admin/router';
import { authenticateRequest } from './admin/middleware/auth';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);

      // Handle admin routes
      if (url.pathname.startsWith('/admin/')) {
        // Authenticate the request
        const authResult = await authenticateRequest(request, env);
        
        // If authentication failed, return the error response
        if (authResult instanceof Response) {
          return authResult;
        }

        // Handle the admin request with the authenticated request object
        return handleAdminRequest(authResult, env);
      }

      // Handle regular pixel routing requests
      return handleRequest(request, env);
    } catch (error) {
      console.error('Worker error:', error);
      return new Response('Internal Server Error', {
        status: 500,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
  }
};