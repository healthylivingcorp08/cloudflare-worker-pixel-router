import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import worker from '../../src/index'; // Import the default export from src/index.ts
import { routeRequest } from '../../src/router'; // Import the function actually called by index.ts
import type { Env } from '../../src/types';
import type { KVNamespace, ExecutionContext, Request as CfRequest } from '@cloudflare/workers-types'; // Keep CfRequest for reference if needed

// Mock the router module
vi.mock('../../src/router');

// Mock console methods
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

// --- Test Setup ---

// Helper to create mock Env
const createMockEnv = (): Env => {
    const mockKVNamespace = {
        get: vi.fn(), put: vi.fn(), list: vi.fn(), delete: vi.fn(), getWithMetadata: vi.fn(),
    } as unknown as KVNamespace;
    return {
        PIXEL_CONFIG: mockKVNamespace, PIXEL_STATE: mockKVNamespace,
        STICKY_API_URL: 'mock-sticky-url', STICKY_USERNAME: 'mock-sticky-user', STICKY_PASSWORD: 'mock-sticky-pass',
        JWT_SECRET: 'mock-jwt-secret', ADMIN_UI_ASSETS: mockKVNamespace,
        FB_PIXEL_ID: 'mock-fb-pixel', FB_ACCESS_TOKEN: 'mock-fb-token',
    };
};

// Helper to create mock ExecutionContext
const createMockExecutionContext = (): ExecutionContext => {
    return {
        waitUntil: vi.fn(),
        passThroughOnException: vi.fn(),
        props: {}, // Add dummy props
    } as ExecutionContext;
};

// Helper to create mock Request (Standard Request)
const createMockRequest = (url = 'https://example.com/', method = 'GET'): Request => {
    return new Request(url, { method });
};

// --- Mocks ---
const mockRouteRequest = routeRequest as Mock;

// --- Tests ---

describe('Worker Fetch Handler (src/index.ts)', () => {
    let env: Env;
    let ctx: ExecutionContext;
    let request: Request;

    beforeEach(() => {
        vi.clearAllMocks();
        env = createMockEnv();
        ctx = createMockExecutionContext();
        request = createMockRequest();

        // Default successful response from routeRequest
        mockRouteRequest.mockResolvedValue(new Response('OK from router', { status: 200 }));
    });

    it('should call routeRequest with request, env, and ctx', async () => {
        // Pass the standard Request directly
        await worker.fetch(request, env, ctx);

        expect(mockRouteRequest).toHaveBeenCalledTimes(1);
        // Verify routeRequest was called with the correct arguments
        expect(mockRouteRequest).toHaveBeenCalledWith(request, env, ctx);
    });

    it('should return the response from routeRequest', async () => {
        const expectedResponse = new Response('Specific Response', { status: 201 });
        mockRouteRequest.mockResolvedValue(expectedResponse);

        // Pass the standard Request directly
        const response = await worker.fetch(request, env, ctx);

        expect(response).toBe(expectedResponse);
        expect(response.status).toBe(201);
        const text = await response.text();
        expect(text).toBe('Specific Response');
    });

    it('should propagate errors thrown by routeRequest', async () => {
        const routeError = new Error('Router exploded!');
        mockRouteRequest.mockRejectedValue(routeError);

        // Expect the call to worker.fetch itself to reject because index.ts doesn't catch
        await expect(worker.fetch(request, env, ctx)).rejects.toThrow(routeError);

        expect(mockRouteRequest).toHaveBeenCalledTimes(1);
        // consoleErrorSpy might be called within routeRequest's catch block (if it has one),
        // but index.ts itself doesn't log the error here.
        // expect(consoleErrorSpy).toHaveBeenCalledWith('Worker fetch handler error:', routeError); // This might fail depending on router's error handling
    });

     it('should handle non-Error objects thrown from routeRequest', async () => {
        const routeError = 'Just a string error'; // Throwing a non-Error
        mockRouteRequest.mockRejectedValue(routeError);

        // Expect the call to worker.fetch itself to reject
        await expect(worker.fetch(request, env, ctx)).rejects.toBe(routeError);

        expect(mockRouteRequest).toHaveBeenCalledTimes(1);
    });
});