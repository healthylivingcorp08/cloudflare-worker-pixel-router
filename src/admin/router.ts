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

const adminHtml = `<!DOCTYPE html>
<html>
<head>
    <title>Pixel Router Admin</title>
    <style>
        body { 
            font-family: -apple-system, sans-serif; 
            max-width: 1200px; 
            margin: 0 auto; 
            padding: 20px;
            background: #f5f5f5;
        }
        .card { 
            background: #fff; 
            padding: 20px; 
            border-radius: 8px; 
            margin-bottom: 20px; 
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header-actions {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }
        .filters {
            display: flex;
            gap: 10px;
            margin-bottom: 15px;
        }
        .filters select, .filters input {
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            min-width: 150px;
        }
        .filters input {
            flex-grow: 1;
        }
        table { 
            width: 100%; 
            border-collapse: collapse; 
        }
        th, td { 
            text-align: left; 
            padding: 12px; 
            border-bottom: 1px solid #ddd; 
        }
        th {
            background: #f8f9fa;
            white-space: nowrap;
        }
        .value-cell {
            font-family: monospace;
            background: #f8f9fa;
            padding: 4px 8px;
            border-radius: 4px;
        }
        button { 
            background: #007bff; 
            color: white; 
            border: none; 
            padding: 8px 16px; 
            border-radius: 4px; 
            cursor: pointer; 
            white-space: nowrap;
        }
        button:hover { 
            background: #0056b3; 
        }
        .action-button {
            background: #28a745;
        }
        .action-button:hover {
            background: #218838;
        }
        .bulk-actions {
            margin-bottom: 15px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 4px;
            display: flex;
            gap: 10px;
            align-items: center;
        }
        .checkbox-cell {
            width: 30px;
        }
        .loading {
            display: none;
            color: #666;
            margin-left: 10px;
        }
        .user-info {
            color: #666;
            font-size: 14px;
            margin-left: 15px;
        }
    </style>
</head>
<body>
    <div class="card">
        <div class="header-actions">
            <div>
                <h1>Pixel Router Admin</h1>
                <span class="user-info">Requires authentication - contact admin for access</span>
            </div>
            <div>
                <button class="action-button" onclick="reloadData()">
                    ↻ Reload Values
                </button>
                <span id="loading" class="loading">Loading...</span>
            </div>
        </div>
    </div>

    <div class="card">
        <h2>KV Values</h2>
        <div class="filters">
            <select id="siteFilter">
                <option value="">All Sites</option>
            </select>
            <select id="typeFilter">
                <option value="">All Types</option>
            </select>
            <input type="text" id="searchFilter" placeholder="Search keys or values...">
        </div>
        <div class="bulk-actions">
            <button onclick="bulkEdit()">Bulk Edit Selected</button>
            <button onclick="selectAll()">Select All</button>
            <button onclick="deselectAll()">Deselect All</button>
            <span id="selectedCount"></span>
        </div>
        <div id="kvValues"></div>
    </div>

    <script>
        let kvData = [];
        let sites = new Set();
        let types = new Set();

        function updateFilters() {
            const siteSelect = document.getElementById('siteFilter');
            const typeSelect = document.getElementById('typeFilter');
            
            siteSelect.innerHTML = '<option value="">All Sites</option>';
            typeSelect.innerHTML = '<option value="">All Types</option>';
            
            [...sites].sort().forEach(site => {
                siteSelect.innerHTML += \`<option value="\${site}">\${site}</option>\`;
            });
            
            [...types].sort().forEach(type => {
                typeSelect.innerHTML += \`<option value="\${type}">\${type}</option>\`;
            });
        }

        function updateSelectedCount() {
            const count = document.querySelectorAll('.kv-select:checked').length;
            const total = document.querySelectorAll('.kv-select').length;
            document.getElementById('selectedCount').textContent = 
                count ? \`\${count} of \${total} selected\` : '';
        }

        function filterAndDisplayKVData() {
            const siteFilter = document.getElementById('siteFilter').value;
            const typeFilter = document.getElementById('typeFilter').value;
            const searchFilter = document.getElementById('searchFilter').value.toLowerCase();
            
            const filteredData = kvData.filter(item => {
                if (item.key === 'site_config_siteA') return false; // Hide site config
                const matchesSite = !siteFilter || item.key.startsWith(siteFilter);
                const matchesType = !typeFilter || item.type === typeFilter;
                const matchesSearch = !searchFilter || 
                    item.key.toLowerCase().includes(searchFilter) || 
                    item.value.toLowerCase().includes(searchFilter);
                return matchesSite && matchesType && matchesSearch;
            });
            
            displayKVData(filteredData);
            updateSelectedCount();
        }

        function displayKVData(data) {
            const table = \`
                <table>
                    <thead>
                        <tr>
                            <th class="checkbox-cell"></th>
                            <th>Key</th>
                            <th>Value</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        \${data.map(item => \`
                            <tr>
                                <td class="checkbox-cell">
                                    <input type="checkbox" class="kv-select" data-key="\${item.key}" onchange="updateSelectedCount()">
                                </td>
                                <td>\${item.key}</td>
                                <td class="value-cell">\${item.value}</td>
                                <td>
                                    <button onclick="editValue('\${item.key}')">Edit</button>
                                </td>
                            </tr>
                        \`).join('')}
                    </tbody>
                </table>
            \`;
            
            document.getElementById('kvValues').innerHTML = data.length ? table :
                '<p>No matching values found</p>';
        }

        function selectAll() {
            document.querySelectorAll('.kv-select').forEach(cb => cb.checked = true);
            updateSelectedCount();
        }

        function deselectAll() {
            document.querySelectorAll('.kv-select').forEach(cb => cb.checked = false);
            updateSelectedCount();
        }

        async function bulkEdit() {
            const selected = Array.from(document.querySelectorAll('.kv-select:checked'))
                .map(cb => cb.dataset.key);
            
            if (selected.length === 0) {
                alert('Please select at least one item');
                return;
            }

            const newValue = prompt('Enter new value for selected items:');
            if (newValue === null) return;

            try {
                const updates = selected.map(key => ({ key, value: newValue }));
                const response = await fetch('/admin/api/kv/bulk', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updates)
                });

                const result = await response.json();
                if (result.success) {
                    alert('Values updated successfully!');
                    reloadData();
                } else {
                    alert('Failed to update values: ' + result.error);
                }
            } catch (error) {
                alert('Error updating values: ' + error);
            }
        }

        async function editValue(key) {
            const newValue = prompt('Enter new value:');
            if (newValue !== null) {
                try {
                    const response = await fetch(\`/admin/api/kv/\${key}\`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ value: newValue })
                    });
                    const data = await response.json();
                    if (data.success) {
                        alert('Value updated successfully!');
                        reloadData();
                    } else {
                        alert('Failed to update value: ' + data.error);
                    }
                } catch (error) {
                    alert('Error updating value: ' + error);
                }
            }
        }

        async function reloadData() {
            const loadingEl = document.getElementById('loading');
            loadingEl.style.display = 'inline';
            
            try {
                kvData = [];
                sites = new Set();
                types = new Set();

                const [_, listData] = await Promise.all([
                    Promise.resolve(), // Removed site config fetch
                    fetch('/admin/api/kv/list').then(r => r.json())
                ]);

                if (listData.success) {
                    for (const key of listData.data) {
                        if (key.name === 'site_config_siteA') continue; // Skip site config
                        const valueResponse = await fetch(\`/admin/api/kv/\${key.name}\`);
                        const valueData = await valueResponse.json();
                        
                        const parts = key.name.split('_');
                        const site = parts[0];
                        const type = parts.slice(1, -1).join('_');
                        
                        sites.add(site);
                        if (type) types.add(type);
                        
                        kvData.push({
                            key: key.name,
                            value: valueData.data.value,
                            site,
                            type
                        });
                    }

                    updateFilters();
                    filterAndDisplayKVData();
                }
            } catch (error) {
                alert('Error reloading data: ' + error);
            } finally {
                loadingEl.style.display = 'none';
            }
        }

        // Initial load
        reloadData();

        // Add event listeners for filters
        document.getElementById('siteFilter').addEventListener('change', filterAndDisplayKVData);
        document.getElementById('typeFilter').addEventListener('change', filterAndDisplayKVData);
        document.getElementById('searchFilter').addEventListener('input', filterAndDisplayKVData);
    </script>
</body>
</html>`;

// Handle admin UI requests
async function handleAdminUI(request: Request): Promise<Response> {
    console.log('[Admin UI] Serving admin interface');
    return new Response(adminHtml, {
        headers: { 'Content-Type': 'text/html' }
    });
}

// Handle API requests
async function handleAPI(request: AuthenticatedRequest, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace('/admin/api', '');
    console.log('[Admin API] Handling request:', path);

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
        if (path === '/sites') {
            return handleListSites(request, env);
        }

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
                case 'GET': return handleGetValue(request, env, key);
                case 'PUT': return handleUpdateValue(request, env, key);
                case 'DELETE': return handleDeleteValue(request, env, key);
                default: return errorResponse('Method not allowed', 405);
            }
        }

        return errorResponse('Not Found', 404);
    } catch (error) {
        console.error('[Admin API] Error:', error);
        return errorResponse('Internal Server Error', 500);
    }
}

export async function handleAdminRequest(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/admin/api/')) {
        return handleAPI(request as AuthenticatedRequest, env);
    }
    if (url.pathname === '/admin' || url.pathname === '/admin/') {
        return handleAdminUI(request);
    }
    return new Response('Not Found', { status: 404 });
}