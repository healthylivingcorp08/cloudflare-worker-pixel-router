// Removed unused useRouter import

// Define a type for the expected error structure from the API
interface ApiError {
    error: string;
}

// Define a generic success response type if needed, though often not required if just checking status
// interface ApiSuccess { success: boolean; }

/**
 * Performs an authenticated fetch request to the admin API.
 * Handles JWT token retrieval, authorization header, and error handling including redirects.
 *
 * @param url The API endpoint URL (relative to the base URL, e.g., '/admin/api/kv-keys').
 * @param options Standard Fetch API options object.
 * @returns A Promise resolving to the parsed JSON response or success status.
 * @throws An error if the fetch fails or the API returns an error status.
 */
export async function authFetch<T = unknown>(url: string, options: RequestInit = {}): Promise<T> { // Default generic to unknown
    // This function needs to be called from within a component or hook where useRouter is available
    // We'll wrap the core logic and call it from a hook or component context later if needed for router access.
    // For now, let's handle the core fetch logic. Direct router usage here is problematic server-side or outside components.

    const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;

    if (!token && typeof window !== 'undefined') {
        // Cannot use useRouter hook directly here. Redirection logic needs to be handled
        // by the component calling this function or within an effect.
        console.error('No auth token found. Redirecting to login should be handled by the caller.');
        // Throw an error to signal the calling component to redirect.
        throw new Error('AUTH_TOKEN_MISSING');
        // Alternatively, could return a specific object/status, but throwing makes the control flow clearer.
        // window.location.href = '/login'; // Avoid direct manipulation if possible, prefer Next.js router
    }

    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${token}`);
    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
        headers.set('Content-Type', 'application/json');
    }

    const fetchOptions: RequestInit = {
        ...options,
        headers,
    };

    try {
        const response = await fetch(url, fetchOptions);

        if (response.status === 401) {
            console.error('Unauthorized (401). Token might be invalid or expired.');
            if (typeof window !== 'undefined') {
                localStorage.removeItem('adminToken');
                // Signal the caller to redirect
                throw new Error('UNAUTHORIZED');
                // window.location.href = '/login'; // Avoid direct manipulation
            } else {
                 throw new Error('Unauthorized'); // Server-side context
            }
        }

        if (!response.ok) {
            let errorData: ApiError | null = null;
            try {
                errorData = await response.json();
            } catch { // Removed unused 'e' variable
                // Ignore if response is not JSON
            }
            const errorMessage = errorData?.error || response.statusText || `HTTP error ${response.status}`;
            console.error(`API Error: ${errorMessage}`);
            throw new Error(errorMessage);
        }

        // Handle successful responses
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return await response.json() as T;
        } else {
            // For non-JSON success responses (e.g., DELETE returning 204 No Content),
            // return a generic success object or handle as needed.
            // Returning null or a specific success object might be appropriate.
            // Let's return null for non-JSON success for now.
            return null as T; // Adjust based on expected non-JSON responses
        }

    } catch (error) {
        console.error('authFetch error:', error);
        // Re-throw the error so the calling component can handle it (e.g., show error message)
        // If it's one of our specific errors, re-throw it, otherwise wrap it.
        if (error instanceof Error && (error.message === 'AUTH_TOKEN_MISSING' || error.message === 'UNAUTHORIZED')) {
            throw error;
        }
        throw new Error(`Fetch failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Attempts to log in the user via the API.
 * This function does NOT use authFetch as it's an unauthenticated endpoint.
 *
 * @param username The username.
 * @param password The password.
 * @returns A Promise resolving to the parsed JSON response (e.g., { token: '...' }).
 * @throws An error if the fetch fails or the API returns an error status.
 */
export async function login(username: string, password: string): Promise<{ success: boolean; data: { token: string } }> {
    const url = '/admin/api/auth/login'; // The worker proxies this
    const options: RequestInit = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
    };

    try {
        const response = await fetch(url, options);

        const responseData = await response.json(); // Attempt to parse JSON regardless of status

        if (!response.ok) {
            // Use the error message from the parsed JSON if available, otherwise use statusText
            const errorMessage = responseData?.error || response.statusText || `HTTP error ${response.status}`;
            console.error(`Login API Error: ${errorMessage}`);
            throw new Error(errorMessage);
        }

        // Successful login returns { success: true, data: { token: '...' } }
        if (!responseData || typeof responseData.data?.token !== 'string') {
             console.error('Login API Error: Invalid response format. Token missing in response.data.');
             throw new Error('Invalid response format from login API.');
        }

        // Return the whole success object, the caller can extract the token
        return responseData as { success: boolean; data: { token: string } };

    } catch (error) {
        console.error('Login fetch error:', error);
        // Re-throw the error for the calling component (LoginPage) to handle
        throw error; // Keep the original error type/message if possible
    }
}

// Example of how to handle redirection in the calling component:
/*
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { authFetch } from '@/lib/api';

function MyComponent() {
    const router = useRouter();

    useEffect(() => {
        const fetchData = async () => {
            try {
                const data = await authFetch('/admin/api/some-data');
                // process data
            } catch (error) {
                if (error instanceof Error && (error.message === 'AUTH_TOKEN_MISSING' || error.message === 'UNAUTHORIZED')) {
                    router.push('/login');
                } else {
                    // handle other errors (e.g., show error message)
                    console.error("Failed to fetch data:", error);
                }
            }
        };
        fetchData();
    }, [router]);

    // ... component render logic
}
*/