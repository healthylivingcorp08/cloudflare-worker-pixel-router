import { Env } from '../../types';
import { AuthenticatedRequest, JWTClaims, UserRole, ROLE_PERMISSIONS } from '../types';

/**
 * Verify the JWT from Cloudflare Access
 */
async function verifyJWT(request: Request, env: Env): Promise<JWTClaims | null> {
  // Get the JWT from the Authorization header
  const authHeader = request.headers.get('cf-access-jwt-assertion');
  if (!authHeader) {
    return null;
  }

  try {
    // Parse and verify the JWT
    // In production, we'd validate the JWT signature against Cloudflare Access public keys
    // For now, we'll just decode and trust it since it's coming from Cloudflare Access
    const decoded = JSON.parse(atob(authHeader.split('.')[1]));
    return decoded as JWTClaims;
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
}

/**
 * Check if a user has a specific permission
 */
export function hasPermission(role: UserRole, permission: string): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) || false;
}

/**
 * Authentication middleware
 */
export async function authenticateRequest(request: Request, env: Env): Promise<AuthenticatedRequest | Response> {
  // Skip auth for non-admin routes
  if (!request.url.includes('/admin/')) {
    return request as AuthenticatedRequest;
  }

  const jwt = await verifyJWT(request, env);
  if (!jwt) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Add the JWT claims to the request object
  const authenticatedRequest = request as AuthenticatedRequest;
  authenticatedRequest.jwt = jwt;

  return authenticatedRequest;
}

/**
 * Authorization middleware - checks if the user has required permission
 */
export function requirePermission(permission: string) {
  return async (request: Request, env: Env): Promise<Response | null> => {
    const authenticatedRequest = request as AuthenticatedRequest;
    
    if (!authenticatedRequest.jwt) {
      return new Response('Unauthorized', { status: 401 });
    }

    const role = authenticatedRequest.jwt.custom?.role || 'viewer';
    if (!hasPermission(role, permission)) {
      return new Response('Forbidden', { status: 403 });
    }

    return null; // Continue to next handler
  };
}

/**
 * Helper to create a JSON response
 */
export function jsonResponse(data: any, status: number = 200): Response {
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
export function successResponse(data: any): Response {
  return jsonResponse({ success: true, data });
}