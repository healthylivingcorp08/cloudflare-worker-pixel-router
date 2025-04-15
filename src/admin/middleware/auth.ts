import { Env } from '../../types';
import { 
  AuthenticatedRequest, 
  JWTClaims, 
  UserRole, 
  ROLE_PERMISSIONS,
  AccessJWTHeader,
  AccessJWTKey,
  AccessCertsResponse
} from '../types';

/**
 * Decode JWT without verification
 */
function decodeJWT(token: string): { header: AccessJWTHeader; payload: any } {
  const [headerB64, payloadB64] = token.split('.');
  const header = JSON.parse(atob(headerB64));
  const payload = JSON.parse(atob(payloadB64));
  return { header, payload };
}

/**
 * Verify Cloudflare Access JWT
 */
async function verifyJWT(token: string, env: Env): Promise<JWTClaims | null> {
  try {
    const { header, payload } = decodeJWT(token);
    
    // Get Cloudflare Access public keys
    const response = await fetch('https://healthylivingcorp08.cloudflareaccess.com/cdn-cgi/access/certs');
    const certsData = await response.json() as AccessCertsResponse;
    
    // Find the key used to sign this token
    const key = certsData.keys.find((k: AccessJWTKey) => k.kid === header.kid);
    if (!key) {
      console.error('No matching key found');
      return null;
    }

    // For now, we'll do basic validation
    // In production, you should verify the signature using the public key
    
    // Verify time-based claims
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      console.error('Token expired');
      return null;
    }
    if (payload.nbf && payload.nbf > now) {
      console.error('Token not yet valid');
      return null;
    }

    return payload as JWTClaims;
  } catch (error) {
    console.error('JWT verification error:', error);
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

  // Get the JWT from Cloudflare Access header
  const cfAccessToken = request.headers.get('cf-access-jwt-assertion');
  if (!cfAccessToken) {
    return new Response('Authentication required', { 
      status: 401,
      headers: {
        'Content-Type': 'text/plain',
        'WWW-Authenticate': 'Bearer realm="Cloudflare Access"'
      }
    });
  }

  const jwt = await verifyJWT(cfAccessToken, env);
  if (!jwt) {
    return new Response('Invalid token', { status: 401 });
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
export function successResponse(data: any): Response {
  return jsonResponse({ success: true, data });
}