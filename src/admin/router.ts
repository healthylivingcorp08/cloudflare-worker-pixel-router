import { Env } from '../types';
import { AuthenticatedRequest, LoginRequest, LoginResponse } from './types';
import { errorResponse, successResponse } from './middleware/auth';
import {
  handleListSites,
  handleGetSiteConfig,
  handleUpdateSiteConfig,
  handleCreateSiteConfig
} from './api/config';
import {
  handleListKeys,
  handleGetValue,
  handleUpdateValue,
  handleDeleteValue,
  handleBulkUpdate
} from './api/kv';

// Login page HTML
const loginHtml = `...`; // Previous login HTML content

// Admin UI HTML
const adminHtml = `...`; // Previous admin HTML content

/**
 * Handle authentication
 */
async function handleAuth(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname === '/admin/api/auth/login' && request.method === 'POST') {
        try {
            const body = await request.json() as LoginRequest;
            const { username, password } = body;

            console.log('[Auth] Login attempt for username:', username);

            if (!username || !password) {
                return errorResponse('Username and password are required', 400);
            }
            
            // Get stored credentials
            const storedPassword = await env.PIXEL_CONFIG.get(`auth_${username}`);
            console.log('[Auth] Checking credentials...');

            if (!storedPassword || storedPassword !== password) {
                console.log('[Auth] Invalid credentials');
                return errorResponse('Invalid credentials', 401);
            }

            console.log('[Auth] Login successful');
            // Generate a simple token
            const token = btoa(`${username}:${Date.now()}`);
            return successResponse<LoginResponse>({ token });
        } catch (error) {
            console.error('[Auth] Login error:', error);
            return errorResponse('Invalid request', 400);
        }
    }

    return errorResponse('Not found', 404);
}

/**
 * Handle admin UI requests
 */
async function handleAdminUI(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    // Serve login page
    if (url.pathname === '/admin/login') {
        return new Response(loginHtml, {
            headers: { 'Content-Type': 'text/html' }
        });
    }

    // Serve admin interface
    return new Response(adminHtml, {
        headers: { 'Content-Type': 'text/html' }
    });
}

/**
 * Handle API requests
 */
async function handleAPI(request: AuthenticatedRequest, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace('/admin/api/', '');

    // Handle CORS
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Max-Age': '86400'
            }
        });
    }

    // Handle auth endpoints
    if (path.startsWith('auth/')) {
        return handleAuth(request, env);
    }

    // Handle KV operations
    try {
        if (path === 'kv/list') {
            return handleListKeys(request, env);
        }

        if (path === 'kv/bulk' && request.method === 'PUT') {
            return handleBulkUpdate(request, env);
        }

        if (path.startsWith('kv/')) {
            const key = path.replace('kv/', '');
            switch (request.method) {
                case 'GET': return handleGetValue(request, env, key);
                case 'PUT': return handleUpdateValue(request, env, key);
                case 'DELETE': return handleDeleteValue(request, env, key);
                default: return errorResponse('Method not allowed', 405);
            }
        }

        return errorResponse('Not found', 404);
    } catch (error) {
        console.error('[Admin API] Error:', error);
        return errorResponse('Internal server error', 500);
    }
}

/**
 * Main admin request handler
 * @param request The incoming request
 * @param env The environment containing KV bindings
 */
export async function handleAdminRequest(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    console.log('[Admin] Request for:', url.pathname);
    
    // Handle API requests
    if (url.pathname.startsWith('/admin/api/')) {
        return handleAPI(request as AuthenticatedRequest, env);
    }

    // Handle UI requests
    return handleAdminUI(request);
}

export default {
    handleAdminRequest
};