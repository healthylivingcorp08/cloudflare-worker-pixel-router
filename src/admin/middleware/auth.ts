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
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, cf-access-jwt-assertion'
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
    const [username, timestamp] = atob(token).split(':');
    const tokenAge = Date.now() - parseInt(timestamp);
    // Token valid for 24 hours
    return tokenAge < 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

/**
 * Authentication middleware
 */
export async function authenticateRequest(request: Request, env: Env): Promise<AuthenticatedRequest | Response> {
  // Skip auth for login endpoint
  if (request.url.includes('/admin/api/auth/login')) {
    return request as AuthenticatedRequest;
  }

  // Skip auth for non-admin routes
  if (!request.url.includes('/admin/')) {
    return request as AuthenticatedRequest;
  }

  // Skip auth for login page
  if (request.url.includes('/admin/login')) {
    return request as AuthenticatedRequest;
  }

  // Get the token from Authorization header
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response('Authentication required', { 
      status: 401,
      headers: {
        'Content-Type': 'text/plain',
        'WWW-Authenticate': 'Bearer'
      }
    });
  }

  const token = authHeader.replace('Bearer ', '');
  if (!verifyAuthToken(token)) {
    return new Response('Invalid or expired token', { status: 401 });
  }

  // Add basic claims to request
  const authenticatedRequest = request as AuthenticatedRequest;
  authenticatedRequest.jwt = {
    aud: [],
    email: 'admin@example.com',
    exp: 0,
    iat: 0,
    nbf: 0,
    iss: 'pixel-router',
    type: 'admin',
    identity_nonce: '',
    sub: 'admin',
    country: 'US',
    custom: {
      role: 'admin'
    }
  };

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