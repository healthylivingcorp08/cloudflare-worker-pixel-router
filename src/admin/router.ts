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
  const url = new URL(request.url);
  
  // For now, return a simple HTML page
  // This will be replaced with the React app
  if (url.pathname === '/admin' || url.pathname === '/admin/') {
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Pixel Router Admin</title>
        </head>
        <body>
          <h1>Pixel Router Admin</h1>
          <p>Admin UI coming soon...</p>
        </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  return new Response('Not Found', { status: 404 });
}

// Handle API requests
async function handleAPI(request: AuthenticatedRequest, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace('/admin/api', '');

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
  
  // Handle API requests
  if (url.pathname.startsWith('/admin/api/')) {
    return handleAPI(request as AuthenticatedRequest, env);
  }
  
  // Handle UI requests
  return handleAdminUI(request);
}