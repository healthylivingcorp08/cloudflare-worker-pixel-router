import { Env } from '../types';

// Import admin.js content as a string
const adminJs = `let allKVEntries = []; // Store all entries for filtering

// Get auth token from localStorage
function getAuthToken() {
    return localStorage.getItem('adminToken');
}

// Make authenticated fetch request
async function authFetch(url, options = {}) {
    const token = getAuthToken();
    if (!token) {
        window.location.href = '/admin/login'; // Redirect if no token
        return Promise.reject('No auth token found'); // Return a rejected promise
    }

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${token}\`,
        ...(options.headers || {})
    };

    try {
        const response = await fetch(url, { ...options, headers });

        if (response.status === 401) {
            // Token expired or invalid
            localStorage.removeItem('adminToken');
            window.location.href = '/admin/login';
            return Promise.reject('Unauthorized'); // Return a rejected promise
        }

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(\`HTTP error! status: \${response.status}, message: \${errorText}\`);
        }

        // Handle cases where response might be empty (e.g., DELETE)
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            return await response.json();
        } else {
            return { success: true }; // Assume success for non-JSON responses if status is OK
        }
    } catch (error) {
        console.error('Fetch error:', error);
        alert(\`An error occurred: \${error.message}. Please try again.\`);
        throw error; // Re-throw error for further handling if needed
    }
}

// Render table rows based on provided data
function renderTable(data) {
    const tableBody = document.getElementById('kv-entries');
    tableBody.innerHTML = ''; // Clear existing rows

    if (!data || data.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="3">No entries found.</td>';
        tableBody.appendChild(row);
        return;
    }

    data.forEach(entry => {
        const row = document.createElement('tr');
        // Ensure value is displayed correctly, even if null/undefined
        const displayValue = entry.value !== null && entry.value !== undefined ? entry.value : 'N/A';
        row.innerHTML = \`
            <td>\${entry.name}</td>
            <td>\${displayValue}</td>
            <td>
                <button class="action-btn edit-btn" onclick="editKey('\${entry.name}', '\${displayValue}')">Edit</button>
                <button class="action-btn delete-btn" onclick="deleteKey('\${entry.name}')">Delete</button>
            </td>
        \`;
        tableBody.appendChild(row);
    });
}

// Filter table data
function filterTable() {
    const filterValue = document.getElementById('kv-filter').value.toLowerCase();
    const filteredData = allKVEntries.filter(entry =>
        entry.name.toLowerCase().includes(filterValue) ||
        (entry.value && entry.value.toLowerCase().includes(filterValue))
    );
    renderTable(filteredData);
}

// Load KV entries for a specific site and setup filters/listeners
async function loadKVEntriesAndSetup(siteId) {
    if (!siteId) {
        console.error("No siteId provided to loadKVEntriesAndSetup");
        // Optionally clear the table or show a message
        const tableBody = document.getElementById('kv-entries');
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="3">Please select a site.</td></tr>';
        }
        allKVEntries = []; // Clear stored data
        return;
    }

    console.log(\`Loading KV entries for site: \${siteId}\`);
    try {
        const response = await authFetch(\`/admin/api/kv/list?siteId=\${siteId}\`); // Fetch for the specified site
        allKVEntries = response.data || []; // Extract the data array
        renderTable(allKVEntries); // Render the table with new data

        // Ensure filter/bulk listeners are attached (only needs to happen once, really)
        // Consider moving listener setup outside this function if it causes issues
        const filterInput = document.getElementById('kv-filter');
        if (filterInput && !filterInput.dataset.listenerAttached) {
            filterInput.addEventListener('input', filterTable);
            filterInput.dataset.listenerAttached = 'true'; // Mark as attached
        }
        const bulkEditBtn = document.getElementById('bulk-edit-btn');
        if (bulkEditBtn && !bulkEditBtn.dataset.listenerAttached) {
            bulkEditBtn.addEventListener('click', () => alert('Bulk Edit functionality not yet implemented.'));
            bulkEditBtn.dataset.listenerAttached = 'true'; // Mark as attached
        }

    } catch (error) {
        console.error(\`Error loading KV entries for site \${siteId}:\`, error);
        const tableBody = document.getElementById('kv-entries');
        if (tableBody) {
            tableBody.innerHTML = \`<tr><td colspan="3">Error loading data for site \${siteId}.</td></tr>\`;
        }
        allKVEntries = []; // Clear data on error
    }
}

// Populate site dropdown and load initial data
async function initializeSiteSelector() {
    const siteSelect = document.getElementById('site-select');
    if (!siteSelect) return; // Exit if dropdown doesn't exist

    try {
        const sitesResponse = await authFetch('/admin/api/sites');
        const sites = sitesResponse.data || [];

        if (sites.length === 0) {
             siteSelect.innerHTML = '<option value="">No sites found</option>';
             loadKVEntriesAndSetup(null); // Load with null to show message
             return;
        }

        // Populate dropdown
        sites.forEach(siteId => {
            const option = document.createElement('option');
            option.value = siteId;
            option.textContent = siteId;
            siteSelect.appendChild(option);
        });

        // Set default selection (e.g., 'siteA' if it exists, otherwise the first site)
        const defaultSite = sites.includes('siteA') ? 'siteA' : sites[0];
        siteSelect.value = defaultSite;

        // Add event listener to load data on change
        siteSelect.addEventListener('change', (event) => {
            loadKVEntriesAndSetup(event.target.value);
        });

        // Load initial data for the default site
        loadKVEntriesAndSetup(defaultSite);

    } catch (error) {
        console.error("Error initializing site selector:", error);
        siteSelect.innerHTML = '<option value="">Error loading sites</option>';
        loadKVEntriesAndSetup(null); // Load with null to show message
    }
}

// Edit key - Pass current value to pre-fill prompt
async function editKey(key, currentValue) {
    const newValue = prompt(\`Enter new value for \${key}:\`, currentValue);
    if (newValue !== null) { // Check if user cancelled prompt
        try {
            await authFetch(\`/admin/api/kv/\${key}\`, {
                method: 'PUT',
                body: JSON.stringify({ value: newValue })
            });
            // Re-fetch data to reflect changes accurately
            await loadKVEntriesAndSetup();
        } catch (error) {
            console.error(\`Error updating key \${key}:\`, error);
            // Error alert is handled in authFetch
        }
    }
}

// Delete key
async function deleteKey(key) {
    if (confirm(\`Are you sure you want to delete key: \${key}?\`)) {
        try {
            await authFetch(\`/admin/api/kv/\${key}\`, {
                method: 'DELETE'
            });
            // Re-fetch data to reflect deletion
            await loadKVEntriesAndSetup();
        } catch (error) {
            console.error(\`Error deleting key \${key}:\`, error);
            // Error alert is handled in authFetch
        }
    }
}

// Initial load on page ready
document.addEventListener('DOMContentLoaded', () => {
    if (!getAuthToken()) {
        window.location.href = '/admin/login';
    } else {
        // HTML elements (dropdown, filter, button) are now part of the static HTML template
        // Initialize the site selector, which will then load initial KV data
        initializeSiteSelector();
    }
});`;
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

    // Serve admin.js
    if (url.pathname === '/admin/ui/admin.js') {
        console.log('[Admin UI] Serving admin.js');
        return new Response(adminJs, {
            headers: { 'Content-Type': 'application/javascript' }
        });
    }

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
    try {
        const url = new URL(request.url);
        console.log('[Admin] Request for:', url.pathname);

        // Handle API requests
        if (url.pathname.startsWith('/admin/api/')) {
            console.log('[Admin] Handling API request');
            // Note: Authentication check happens in src/index.ts *before* calling this for protected API routes
            const response = await handleAPI(request as AuthenticatedRequest, env);
            console.log('[Admin] API response status:', response.status);
            return response;
        }

        // Handle UI requests
        console.log('[Admin] Handling UI request');
        const response = await handleAdminUI(request);
        console.log('[Admin] UI response status:', response.status);
        return response;
    } catch (error) {
        console.error('[Admin] Error handling request:', error);
        return new Response('Internal Server Error', {
            status: 500,
            headers: {
                'Content-Type': 'text/plain',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            }
        });
    }
}