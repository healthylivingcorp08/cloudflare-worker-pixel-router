import { Env } from '../types';
import { AuthenticatedRequest } from './types';
import { errorResponse } from './middleware/auth';

// API Handlers
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

// Handle admin UI requests
async function handleAdminUI(request: Request): Promise<Response> {
    console.log('Serving admin UI');
    return new Response(`<!DOCTYPE html>
<html>
<head>
    <title>Pixel Router Admin</title>
    <style>
        body { font-family: -apple-system, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
        .card { background: #fff; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        table { width: 100%; border-collapse: collapse; }
        th, td { text-align: left; padding: 12px; border-bottom: 1px solid #ddd; }
        button { background: #007bff; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; }
    </style>
</head>
<body>
    <div class="card">
        <h1>Pixel Router Admin</h1>
        <p>Loading configuration...</p>
    </div>

    <div class="card">
        <h2>Site Configuration</h2>
        <div id="siteConfig"></div>
    </div>

    <div class="card">
        <h2>KV Values</h2>
        <div id="kvValues"></div>
    </div>

    <script>
        // Fetch and display site config
        fetch('/admin/api/config/siteA')
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    const pre = document.createElement('pre');
                    pre.textContent = JSON.stringify(data.data, null, 2);
                    document.getElementById('siteConfig').appendChild(pre);
                }
            });

        // Fetch and display KV values
        fetch('/admin/api/kv/list')
            .then(response => response.json())
            .then(async data => {
                if (data.success) {
                    const table = document.createElement('table');
                    table.innerHTML = '<tr><th>Key</th><th>Value</th><th>Actions</th></tr>';
                    const tbody = document.createElement('tbody');
                    
                    for (const key of data.data) {
                        const valueResponse = await fetch(\`/admin/api/kv/\${key.name}\`);
                        const valueData = await valueResponse.json();
                        
                        const tr = document.createElement('tr');
                        tr.innerHTML = \`
                            <td>\${key.name}</td>
                            <td><code>\${valueData.data.value}</code></td>
                            <td><button onclick="editValue('\${key.name}')">Edit</button></td>
                        \`;
                        tbody.appendChild(tr);
                    }
                    
                    table.appendChild(tbody);
                    document.getElementById('kvValues').appendChild(table);
                }
            });

        // Function to edit KV values
        async function editValue(key) {
            const newValue = prompt('Enter new value:');
            if (newValue !== null) {
                const response = await fetch(\`/admin/api/kv/\${key}\`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ value: newValue })
                });
                const data = await response.json();
                if (data.success) {
                    alert('Value updated successfully!');
                    location.reload();
                } else {
                    alert('Failed to update value: ' + data.error);
                }
            }
        }
    </script>
</body>
</html>`, {
        headers: { 'Content-Type': 'text/html' }
    });
}

// Handle API requests
async function handleAPI(request: AuthenticatedRequest, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace('/admin/api', '');

    console.log('Handling API request:', path);

    // Handle CORS preflight requests
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

    try {
        // Site Configuration endpoints
        if (path === '/sites') {
            return handleListSites(request, env);
        }

        if (path.match(/^\/config\/[^\/]+$/)) {
            const siteId = path.split('/').pop()!;
            
            switch (request.method) {
                case 'GET':
                    return handleGetSiteConfig(request, env, siteId);
                case 'PUT':
                    return handleUpdateSiteConfig(request, env, siteId);
                case 'POST':
                    return handleCreateSiteConfig(request, env, siteId);
                default:
                    return errorResponse('Method not allowed', 405);
            }
        }

        // KV Management endpoints
        if (path === '/kv/list') {
            return handleListKeys(request, env);
        }

        if (path === '/kv/bulk') {
            if (request.method === 'PUT') {
                return handleBulkUpdate(request, env);
            }
            return errorResponse('Method not allowed', 405);
        }

        if (path.match(/^\/kv\/[^\/]+$/)) {
            const key = path.split('/').pop()!;
            
            switch (request.method) {
                case 'GET':
                    return handleGetValue(request, env, key);
                case 'PUT':
                    return handleUpdateValue(request, env, key);
                case 'DELETE':
                    return handleDeleteValue(request, env, key);
                default:
                    return errorResponse('Method not allowed', 405);
            }
        }

        return errorResponse('Not Found', 404);
    } catch (error) {
        console.error('API Error:', error);
        return errorResponse('Internal Server Error', 500);
    }
}

// Main admin request handler
export async function handleAdminRequest(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    console.log('Admin Request:', url.pathname);
    
    // Handle API requests
    if (url.pathname.startsWith('/admin/api/')) {
        return handleAPI(request as AuthenticatedRequest, env);
    }
    
    // Handle UI requests
    return handleAdminUI(request);
}