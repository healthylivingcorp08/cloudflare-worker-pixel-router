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

// Enhanced Login page HTML
const loginHtml = `<!DOCTYPE html>
<html>
<head>
    <title>Login - Pixel Router Admin</title>
    <style>
        body {
            font-family: 'Inter', sans-serif;
            background: #f8fafc;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
        }
        .login-container {
            background: white;
            padding: 2rem;
            border-radius: 0.5rem;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            width: 100%;
            max-width: 400px;
        }
        .login-title {
            font-size: 1.5rem;
            font-weight: 600;
            margin-bottom: 1.5rem;
            color: #1e293b;
        }
        .form-group {
            margin-bottom: 1rem;
        }
        label {
            display: block;
            margin-bottom: 0.5rem;
            font-weight: 500;
            color: #334155;
        }
        input {
            width: 100%;
            padding: 0.5rem;
            border: 1px solid #e2e8f0;
            border-radius: 0.25rem;
            font-size: 1rem;
        }
        button {
            width: 100%;
            padding: 0.75rem;
            background: #3b82f6;
            color: white;
            border: none;
            border-radius: 0.25rem;
            font-weight: 500;
            cursor: pointer;
            margin-top: 1rem;
        }
        button:hover {
            background: #2563eb;
        }
        .error {
            color: #ef4444;
            margin-top: 0.5rem;
            font-size: 0.875rem;
        }
    </style>
</head>
<body>
    <div class="login-container">
        <h1 class="login-title">Admin Login</h1>
        <form id="loginForm">
            <div class="form-group">
                <label for="username">Username</label>
                <input type="text" id="username" name="username" required>
            </div>
            <div class="form-group">
                <label for="password">Password</label>
                <input type="password" id="password" name="password" required>
            </div>
            <button type="submit">Login</button>
            <div id="error" class="error"></div>
        </form>
    </div>
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

// Admin UI with KV editing functionality
const adminHtml = `<!DOCTYPE html>
<html>
<head>
    <title>Admin Dashboard</title>
    <style>
        body {
            font-family: 'Inter', sans-serif;
            margin: 0;
            padding: 0;
            background: #f8fafc;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 2rem;
        }
        .title {
            font-size: 1.5rem;
            font-weight: 600;
            color: #1e293b;
        }
        .logout-btn {
            padding: 0.5rem 1rem;
            background: #ef4444;
            color: white;
            border: none;
            border-radius: 0.25rem;
            cursor: pointer;
        }
        .kv-table {
            width: 100%;
            border-collapse: collapse;
            background: white;
            border-radius: 0.5rem;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .kv-table th, .kv-table td {
            padding: 1rem;
            text-align: left;
            border-bottom: 1px solid #e2e8f0;
        }
        .kv-table th {
            background: #f1f5f9;
            font-weight: 500;
            color: #334155;
        }
        .action-btn {
            padding: 0.25rem 0.5rem;
            margin-right: 0.5rem;
            border-radius: 0.25rem;
            cursor: pointer;
        }
        .edit-btn {
            background: #3b82f6;
            color: white;
            border: none;
        }
        .delete-btn {
            background: #ef4444;
            color: white;
            border: none;
        }
        .filter-container {
            margin-bottom: 1rem;
            display: flex;
            gap: 1rem;
            align-items: center;
            flex-wrap: wrap; /* Allow wrapping on smaller screens */
        }
        .filter-input {
            padding: 0.5rem;
            border: 1px solid #e2e8f0;
            border-radius: 0.25rem;
            flex-grow: 1; /* Take available space */
        }
        .bulk-edit-btn {
             background: #f59e0b; /* Amber color */
             color: white;
             border: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="title">Admin Dashboard</h1>
            <button class="logout-btn" onclick="localStorage.removeItem('adminToken'); window.location.href='/admin/login';">Logout</button>
        </div>

        <h2>KV Store Editor</h2>
        <div class="filter-container">
            <label for="site-select">Site:</label>
            <select id="site-select" class="filter-input" style="flex-grow: 0; min-width: 150px;"></select>
            <input type="text" id="kv-filter" placeholder="Filter by key or value..." class="filter-input">
            <button id="bulk-edit-btn" class="action-btn bulk-edit-btn">Bulk Edit</button>
        </div>
        <table class="kv-table">
            <thead>
                <tr>
                    <th>Key</th>
                    <th>Value</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody id="kv-entries">
                <!-- KV entries will be loaded here via JavaScript -->
            </tbody>
        </table>

        <script src="/admin/ui/admin.js"></script>
    </div>
</body>
</html>`;

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

    // Handle KV operations / Site Config operations
    try {
        // Site listing
        if (path === 'sites' && request.method === 'GET') {
             return handleListSites(request, env);
        }

        // KV Listing
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