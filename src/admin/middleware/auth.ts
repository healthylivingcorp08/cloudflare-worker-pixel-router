import { Env } from '../../types';
import { AuthenticatedRequest, JWTClaims, UserRole, ROLE_PERMISSIONS } from '../types';

/**
 * Helper to create a JSON response
 */
export function jsonResponse<T = any>(data: T, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}

/**
 * Create an error response
 */
export function errorResponse(message: string, status: number = 400): Response {
  return jsonResponse({ success: false, error: message }, status);
}

/**
 * Create a success response
 */
export function successResponse<T = any>(data: T): Response {
  return jsonResponse({ success: true, data }, 200);
}

/**
 * Check if a user has a specific permission
 */
export function hasPermission(role: UserRole, permission: string): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) || false;
}

/**
 * Verify authentication token
 */
export function verifyAuthToken(token: string): boolean {
  try {
    console.log('[Auth] Verifying token:', token);
    const [username, timestamp] = atob(token).split(':');
    const tokenAge = Date.now() - parseInt(timestamp);
    // Token valid for 24 hours
    const isValid = tokenAge < 24 * 60 * 60 * 1000;
    console.log('[Auth] Token age:', tokenAge, 'isValid:', isValid);
    return isValid;
  } catch (error) {
    console.error('[Auth] Token verification error:', error);
    return false;
  }
}

/**
 * Check if a path should skip authentication
 */
function isPublicPath(pathname: string): boolean {
  const publicPaths = [
    '/admin/login',
    '/admin/api/auth/login'
  ];
  // Ensure exact match or match with trailing slash for login page
  return publicPaths.some(path => pathname === path || pathname === path + '/');
}

/**
 * Authentication middleware - Checks token ONLY for protected API endpoints
 */
export async function authenticateRequest(request: Request, env: Env): Promise<AuthenticatedRequest | Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;
  console.log('[Auth] Checking path:', pathname);

  // Only perform token checks for protected API endpoints
  if (pathname.startsWith('/admin/api/') && !isPublicPath(pathname)) {
    console.log('[Auth] Protected API path, checking token');

    // Get the token from Authorization header or query param (for testing)
    let token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      const url = new URL(request.url);
      token = url.searchParams.get('token') || undefined;
    }

    if (!token) {
      console.log('[Auth] No token found (checked header and query param)');
      return new Response('Authentication required', {
        status: 401,
        headers: {
          'Content-Type': 'text/plain',
          'WWW-Authenticate': 'Bearer realm="Admin API"',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });
    }

    if (!verifyAuthToken(token)) {
      console.log('[Auth] Invalid or expired token for API');
      return new Response('Invalid or expired token', {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });
    }

    console.log('[Auth] API Token valid');
    // Add basic claims to request (assuming admin for now)
    const authenticatedRequest = request as AuthenticatedRequest;
    authenticatedRequest.jwt = {
      aud: [], email: 'admin@example.com', exp: 0, iat: 0, nbf: 0,
      iss: 'pixel-router', type: 'admin', identity_nonce: '', sub: 'admin',
      country: 'US', custom: { role: 'admin' }
    };
    return authenticatedRequest;

  }

  // For all other paths (non-admin, admin UI, public admin API), pass through without token check here.
  // The UI JavaScript will handle redirects for the UI paths if needed.
  console.log('[Auth] Path does not require token check in middleware, passing through');
  return request as AuthenticatedRequest;
}

/**
 * Authorization middleware - checks if the user has required permission
 */
export function requirePermission(permission: string) {
  return async (request: Request, env: Env): Promise<Response | null> => {
    // Skip permission check for public paths
    if (isPublicPath(new URL(request.url).pathname)) {
      return null;
    }

    const authenticatedRequest = request as AuthenticatedRequest;

    if (!authenticatedRequest.jwt) {
      // This should ideally be caught by authenticateRequest, but double-check
      console.error('[Auth] No JWT found in request for permission check:', permission);
      return new Response('Unauthorized', {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });
    }

    const role = authenticatedRequest.jwt.custom?.role || 'viewer'; // Default to viewer if role missing
    const hasAccess = hasPermission(role, permission);
    console.log('[Auth] Permission check:', { role, permission, hasAccess });
    
    if (!hasAccess) {
      return new Response('Forbidden', {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });
    }

    return null; // Continue to next handler
  };
}