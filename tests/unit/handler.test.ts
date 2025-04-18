import { describe, expect, it, vi } from 'vitest';
import { handleRequest } from '../../src/handler';
import type { KVNamespace } from '@cloudflare/workers-types';

describe('Handler', () => {
  const env = {
    PIXEL_CONFIG: {} as KVNamespace,
    STICKY_API_URL: 'http://test',
    STICKY_USERNAME: 'test',
    STICKY_PASSWORD: 'test'
  };

  // Mock the config module
  vi.mock('../../src/config', () => ({
    getConfigForRequest: vi.fn().mockResolvedValue({
      siteId: 'test-site',
      hostnames: ['localhost'],
      scrubPercent: 0,
      pages: {
        home: {
          pixels: [],
          apiEndpoints: []
        }
      }
    })
  }));

  // Mock the resolvers module
  vi.mock('../../src/resolvers', () => ({
    createResolutionContext: vi.fn().mockReturnValue({})
  }));

  // Mock the router module
  vi.mock('../../src/router', () => ({
    routePixel: vi.fn().mockImplementation((config, pathname) => {
      if (pathname === '/home') {
        return Promise.resolve({
          pixels: [],
          apiEndpoints: [],
          shouldScrub: false
        });
      }
      return Promise.reject(new Error('No configuration found for path: ' + pathname));
    }),
    generatePixelHtml: vi.fn().mockReturnValue('')
  }));

  it('should return 200 for known routes', async () => {
    const request = new Request('http://localhost/home');
    const response = await handleRequest(request, env);
    expect(response.status).toBe(200);
  });

  it('should return 404 for unknown routes', async () => {
    const request = new Request('http://localhost/unknown');
    const response = await handleRequest(request, env);
    expect(response.status).toBe(404);
  });
});