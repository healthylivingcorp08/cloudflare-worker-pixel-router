import { Env } from '../types';
import { AuthenticatedRequest, LoginRequest, LoginResponse } from './types';
import { errorResponse, successResponse, verifyAuthToken } from './middleware/auth'; // Use verifyAuthToken
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
  handleBulkUpdate,
  handleCreateValue,
  handleBulkDelete,
  handleCreateSiteFromTemplate,
  handleDeleteSite // Added for site deletion
} from './api/kv';
import { sign } from '@tsndr/cloudflare-worker-jwt'; // Assuming JWT library

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

// Admin UI with KV editing functionality (Single File)
// Removed adminHtml (lines 139-544)

// Removed handleAuth (lines 549-595)


// Removed handleAdminUI (lines 601-632)


/**
 * Handle API requests (requires authentication)
 */
async function handleAPI(request: AuthenticatedRequest, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.substring('/admin/api/'.length); // Remove prefix
    const siteId = url.searchParams.get('siteId'); // Get siteId for context

    console.log(`[API] Handling ${request.method} for path: ${path}, Site: ${siteId || 'N/A'}`);

    // --- KV Operations ---
    if (path.startsWith('kv/')) {
        const kvPath = path.substring('kv/'.length);

        // POST /admin/api/kv/bulk-update?siteId=...
        if (kvPath === 'bulk-update' && request.method === 'POST') {
            return handleBulkUpdate(request, env); // Removed siteId
        }
        // DELETE /admin/api/kv/bulk-delete?siteId=...
        if (kvPath === 'bulk-delete' && request.method === 'DELETE') {
            return handleBulkDelete(request, env); // Removed siteId
        }
        // POST /admin/api/kv/create-template?siteId=...
        if (kvPath === 'create-template' && request.method === 'POST') {
            return handleCreateSiteFromTemplate(request, env); // siteId comes from body
        }

        // Operations requiring a key: /admin/api/kv/{key}?siteId=...
        const encodedKey = kvPath; // Keep the original encoded path segment
        if (!encodedKey) return errorResponse('KV key is required.', 400);

        // Decode the key extracted from the path
        let decodedKey: string;
        try {
            decodedKey = decodeURIComponent(encodedKey);
        } catch (e) {
            console.error(`[API] Failed to decode key: ${encodedKey}`, e);
            return errorResponse('Invalid KV key encoding in URL.', 400);
        }


        switch (request.method) {
            case 'GET':
                return handleGetValue(request, env, decodedKey); // Use decodedKey
            case 'PUT': // Update existing or create new
                 return handleUpdateValue(request, env, decodedKey); // Use decodedKey
            case 'POST': // Explicitly create new (alternative to PUT)
                 // handleCreateValue expects key in body, not path/args
                 // Assuming POST to /admin/api/kv/ creates a new key based on body content
                 // This route doesn't use the path key, so no change needed here.
                 return handleCreateValue(request, env);
            case 'DELETE':
                return handleDeleteValue(request, env, decodedKey); // Use decodedKey
            default:
                return errorResponse(`Method ${request.method} not allowed for KV operations.`, 405);
        }
    } // --- End KV Operations ---

    // --- Config Operations ---
    if (path.startsWith('config/')) {
         const configPath = path.substring('config/'.length);

         // GET /admin/api/config/sites
         if (configPath === 'sites' && request.method === 'GET') {
             return handleListSites(request, env);
         }

         // Operations on a specific site config: /admin/api/config/{siteId}
         const targetSiteId = configPath;
         if (!targetSiteId) return errorResponse('Site ID is required for config operations.', 400);

         switch (request.method) {
             case 'GET':
                 return handleGetSiteConfig(request, env, targetSiteId);
             case 'PUT': // Update existing
                 return handleUpdateSiteConfig(request, env, targetSiteId);
             case 'POST': // Create new
                 return handleCreateSiteConfig(request, env, targetSiteId);
             // DELETE might be added later
             default:
                 return errorResponse(`Method ${request.method} not allowed for site config operations.`, 405);
         }
    } // --- End Config Operations ---

    // --- Site Operations (Beyond Config) ---
    if (path.startsWith('sites/')) {
        const sitePath = path.substring('sites/'.length);
        const targetSiteId = sitePath; // Assuming path is /admin/api/sites/{siteId}

        if (!targetSiteId) return errorResponse('Site ID is required for site operations.', 400);

        switch (request.method) {
            case 'DELETE': // Handle site deletion
                return handleDeleteSite(request, env, targetSiteId);
            // Add other site-specific methods here (e.g., GET for details) if needed
            default:
                return errorResponse(`Method ${request.method} not allowed for site operations.`, 405);
        }
    } // --- End Site Operations ---

    // --- KV Listing (Specific Site or All) ---
    // GET /admin/api/kv-keys?siteId=... (List keys for a specific site)
    if (path === 'kv-keys' && request.method === 'GET') {
        return handleListKeys(request, env); // Removed siteId, function reads from query param
    }


    console.log(`[API] Path not found: ${path}`);
    return errorResponse('API endpoint not found.', 404);
}


/**
 * Main admin request handler
 */
export async function handleAdminRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;
  console.log(`[Admin Router] handleAdminRequest received: ${request.method} ${pathname}`);

  // 1. Serve Login Page (Public) - Handled by Next.js app now, but keep API endpoint
  // if (pathname === '/admin/login') {
  //   console.log('[Admin Router] Serving login page');
  //   return new Response(loginHtml, { headers: { 'Content-Type': 'text/html' } });
  // }

  // 2. Handle Login API Request (Public)
  if (pathname === '/admin/api/auth/login' && request.method === 'POST') {
    console.log('[Admin Router] Handling login API request');
    // Re-implement or call a dedicated auth handler if needed, using env vars
     try {
        const { username, password } = await request.json<LoginRequest>();
        if (!username || !password) return errorResponse('Username and password required', 400);

        if (username === env.ADMIN_USERNAME && password === env.ADMIN_PASSWORD) {
            const secret = env.JWT_SECRET;
            if (!secret) {
                console.error("JWT_SECRET is not set.");
                return errorResponse('JWT secret missing', 500);
            }
            // Payload structure should match expectations in verifyAuthToken
            const payload = {
                sub: username, // Use 'sub' for subject
                custom: { role: 'admin' }, // Add role
                exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) // 24hr expiry
            };
            const token = await sign(payload, secret);
            return successResponse<LoginResponse>({ token });
        } else {
            return errorResponse('Invalid credentials', 401);
        }
    } catch (error) {
        console.error("Login error:", error);
        return errorResponse('Failed to process login', 500);
    }
  }

  // 3. Handle Authenticated API Requests (Auth checked in index.ts or here)
  if (pathname.startsWith('/admin/api/')) {
    console.log('[Admin Router] Handling authenticated API request');
    // Authentication should be verified here or by middleware before calling handleAPI
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
        console.log('[Admin Router] API request missing token.');
        return errorResponse('Authorization token required.', 401);
    }

    const authResult = await verifyAuthToken(token, env.JWT_SECRET); // Pass token string and secret

    // verifyAuthToken now returns JWTClaims | null | Response
    if (authResult instanceof Response) {
      console.log('[Admin Router] API Auth failed (verifyAuthToken returned Response)');
      return authResult; // Return error response if auth fails (e.g., secret missing)
    }

    if (!authResult) {
        console.log('[Admin Router] API Auth failed (verifyAuthToken returned null - invalid/expired token)');
        return errorResponse('Invalid or expired token.', 401);
    }

    // If auth passes, authResult contains the payload; attach it to the request
    (request as AuthenticatedRequest).jwt = authResult; // authResult is confirmed JWTClaims here
    console.log('[Admin Router] API Auth success, proceeding to handleAPI');
    return handleAPI(request as AuthenticatedRequest, env);
  }

  // --- Development Proxy ---
  // If ADMIN_DEV_PROXY is true, proxy ALL requests reaching this handler to the Next.js dev server
  const isAdminDev = env.ADMIN_DEV_PROXY === 'true';
  if (isAdminDev) {
    const nextJsDevServer = 'http://localhost:3000'; // Default Next.js dev port
    // Determine the target path on the Next.js server
    let targetPathname = url.pathname;
    if (targetPathname === '/admin') {
      targetPathname = '/'; // Map /admin requests to the root of the Next.js app
    }

    // Construct URL using the target path, relative to Next.js root
    const proxyUrl = new URL(targetPathname, nextJsDevServer);

    // Preserve search params
    proxyUrl.search = url.search;

    console.log(`[Admin Router] DEV PROXY: Proxying request for ${url.pathname} (to target ${targetPathname}) to Next.js dev server: ${proxyUrl.toString()}`);

    // Clone headers, potentially modify Host header if needed
    const proxyHeaders = new Headers(request.headers);
    proxyHeaders.set('Host', new URL(nextJsDevServer).host);
    // Add any other necessary headers for proxying (e.g., X-Forwarded-For)
    proxyHeaders.set('X-Forwarded-For', request.headers.get('CF-Connecting-IP') || '');
    proxyHeaders.set('X-Forwarded-Proto', url.protocol.slice(0, -1));


    try {
      const proxyResponse = await fetch(proxyUrl.toString(), {
        method: request.method,
        headers: proxyHeaders,
        body: request.body,
        redirect: 'manual', // Let the browser handle redirects
      });

      console.log(`[Admin Router] DEV PROXY: Received response from Next.js for ${proxyUrl.toString()}: Status ${proxyResponse.status}`);

      // Important: Return the response from the Next.js server directly
      // Need to clone the response to make headers mutable for CORS
      const responseToClient = new Response(proxyResponse.body, proxyResponse);

      // Add CORS headers if needed, especially for API routes proxied during dev
      const origin = request.headers.get('Origin');
      // Allow requests from the worker's origin during dev proxying
      if (origin && (['http://localhost:3000', 'http://127.0.0.1:3000', `http://${url.host}`].includes(origin))) {
           responseToClient.headers.set('Access-Control-Allow-Origin', origin);
           responseToClient.headers.set('Access-Control-Allow-Credentials', 'true');
           // Add other necessary CORS headers if requests involve methods other than GET/POST or custom headers
           responseToClient.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
           responseToClient.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token'); // Adjust as needed
      }


      return responseToClient;
    } catch (error) {
      console.error(`[Admin Router] DEV PROXY: Error proxying request to ${nextJsDevServer}:`, error);
      return new Response('Error proxying request to development server.', { status: 502 });
    }
  }
  // --- End Development Proxy ---

  // --- Production Logic (Only runs if isAdminDev is false) ---

  // 1. Handle Login API Request (Public) - Already handled above if isAdminDev is false
  // if (pathname === '/admin/api/auth/login' && request.method === 'POST') { ... } // Logic is above

  // 2. Handle Authenticated API Requests - Already handled above if isAdminDev is false
  // if (pathname.startsWith('/admin/api/')) { ... } // Logic is above

  // 3. Serve Static Assets (Production Only - Placeholder for future)
  // In a real production setup, static assets would likely be served directly
  // by Cloudflare Pages or another static hosting solution, not the worker.
  // This section is a placeholder if the worker needed to serve them.
  // Example:
  // if (pathname.startsWith('/admin/static/')) {
  //   // Logic to serve static files from KV or R2
  //   console.log(`[Admin Router] Attempting to serve static asset: ${pathname}`);
  //   // ... implementation needed ...
  //   return new Response('Static asset serving not implemented', { status: 501 });
  // }

  // Fallback 404 for production if no routes match *after* checking API routes
  console.log(`[Admin Router] Path ${pathname} did not match any admin routes (Production). Returning 404.`);
  return new Response('Not Found', { status: 404 });
}