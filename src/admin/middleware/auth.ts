import { Env } from '../../types';
import { AuthenticatedRequest, JWTClaims, UserRole, ROLE_PERMISSIONS } from '../types';

/**
 * Verify the JWT from Cloudflare Access
 * TODO: Implement proper JWT verification
 */
async function verifyJWT(request: Request, env: Env): Promise<JWTClaims> {
  // For now, return a mock JWT with admin role for testing
  return {
    aud: [],
    email: 'test@example.com',
    exp: 0,
    iat: 0,
    nbf: 0,
    iss: 'test',
    type: 'test',
    identity_nonce: 'test',
    sub: 'test',
    country: 'US',
    custom: {
      role: 'admin' as UserRole
    }
  };
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
export async function authenticateRequest(request: Request, env: Env): Promise<AuthenticatedRequest> {
  // For testing: always authenticate as admin
  const jwt = await verifyJWT(request, env);
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
    
    // For testing: allow all permissions
    return null;
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