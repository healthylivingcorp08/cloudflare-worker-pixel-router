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

// Simplified Login page HTML for testing
const loginHtml = `<!DOCTYPE html>
<html>
<head>
    <title>Login - Pixel Router Admin</title>
    <style> body { font-family: sans-serif; padding: 20px; } </style>
</head>
<body>
    <h1>Admin Login</h1>
    <form id="loginForm">
        <div>
            <label for="username">Username:</label>
            <input type="text" id="username" name="username" required>
        </div>
        <br>
        <div>
            <label for="password">Password:</label>
            <input type="password" id="password" name="password" required>
        </div>
        <br>
        <button type="submit">Login</button>
        <div id="error" style="color: red; margin-top: 10px;"></div>
    </form>
    <script>
        // Clear any existing token on load
        localStorage.removeItem('adminToken');

        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const errorDiv = document.getElementById('error');
            errorDiv.textContent = ''; // Clear previous errors

            try {
                const response = await fetch('/admin/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json();
                if (data.success && data.data.token) {
                    localStorage.setItem('adminToken', data.data.token);
                    window.location.href = '/admin/'; // Redirect to main admin page
                } else {
                    errorDiv.textContent = data.error || 'Login failed. Please check credentials.';
                }
            } catch (error) {
                console.error('Login fetch error:', error);
                errorDiv.textContent = 'An error occurred during login.';
            }
        });
    </script>
</body>
</html>`;

// Admin UI HTML (previous content remains the same...)
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
    if (url.pathname === '/admin/login' || url.pathname === '/admin/login/') {
        console.log('[Admin UI] Serving simplified login page');
        return new Response(loginHtml, {
            headers: { 'Content-Type': 'text/html' }
        });
    }

    // Serve admin interface (placeholder for now)
    // TODO: Add check here to redirect to login if no token is present in request headers/cookies
    console.log('[Admin UI] Serving main admin interface placeholder');
    return new Response(adminHtml, { // Serve the full admin HTML if not login
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

    // Handle auth endpoints explicitly (even though middleware might pass it)
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
 */
export async function handleAdminRequest(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    console.log('[Admin] Request for:', url.pathname);

    // Handle API requests
    if (url.pathname.startsWith('/admin/api/')) {
        // Note: Authentication check happens in src/index.ts *before* calling this for protected API routes
        return handleAPI(request as AuthenticatedRequest, env);
    }

    // Handle UI requests
    // Let handleAdminUI decide which HTML to serve (login or main admin)
    return handleAdminUI(request);
}