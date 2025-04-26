import { Env } from '../types';
import { ExecutionContext } from '@cloudflare/workers-types';
import { addCorsHeaders } from '../middleware/cors'; // Assuming CORS middleware exists

// Placeholder for JWT generation - replace with actual implementation
async function generateJwtToken(username: string, secret: string): Promise<string> {
    // In a real app, use a library like 'jose' or '@tsndr/cloudflare-worker-jwt'
    // This is a highly insecure placeholder:
    console.warn("Using insecure placeholder JWT generation!");
    const header = { alg: 'HS256', typ: 'JWT' };
    const payload = { sub: username, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) }; // Expires in 24 hours
    const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    // Simple signing (NOT SECURE for production)
    const signature = btoa(`${encodedHeader}.${encodedPayload}.${secret}`).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_'); // Replace with actual HMAC-SHA256
    return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Handles admin login requests.
 * Expects username and password in JSON body.
 * Validates against ADMIN_USERNAME and ADMIN_PASSWORD environment variables.
 * Returns a JWT token on success.
 */
export async function handleAdminLogin(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    let response: Response;
    try {
        if (request.method !== 'POST') {
            response = new Response('Method Not Allowed', { status: 405 });
            return addCorsHeaders(response, request); // Apply CORS
        }

        // Ensure required environment variables are set
        if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD || !env.JWT_SECRET) {
             console.error("Missing required admin credentials or JWT secret in environment variables.");
             response = new Response(JSON.stringify({ success: false, error: 'Server configuration error.' }), {
                 status: 500,
                 headers: { 'Content-Type': 'application/json' }
             });
             return addCorsHeaders(response, request); // Apply CORS
        }

        const { username, password } = await request.json<{ username?: string; password?: string }>();

        if (!username || !password) {
            response = new Response(JSON.stringify({ success: false, error: 'Username and password are required.' }), {
                status: 400, // Bad Request
                headers: { 'Content-Type': 'application/json' }
            });
            return addCorsHeaders(response, request); // Apply CORS
        }

        // --- Basic Authentication Check ---
        // IMPORTANT: Use constant-time comparison for security if possible, though less critical for username
        const isValidUsername = username === env.ADMIN_USERNAME;
        // IMPORTANT: Use a secure password hashing/comparison mechanism in production!
        // This direct comparison is vulnerable to timing attacks.
        const isValidPassword = password === env.ADMIN_PASSWORD;

        if (isValidUsername && isValidPassword) {
            // --- Generate JWT Token ---
            const token = await generateJwtToken(username, env.JWT_SECRET);

            response = new Response(JSON.stringify({ success: true, data: { token } }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        } else {
            console.log(`Admin login failed for username: ${username}`);
            response = new Response(JSON.stringify({ success: false, error: 'Invalid credentials.' }), {
                status: 401, // Unauthorized
                headers: { 'Content-Type': 'application/json' }
            });
        }
    } catch (error: any) {
        console.error('Error in handleAdminLogin:', error);
        response = new Response(JSON.stringify({ success: false, error: `Login failed: ${error.message}` }), {
            status: 500, // Internal Server Error
            headers: { 'Content-Type': 'application/json' }
        });
    }

    return addCorsHeaders(response, request); // Apply CORS to all responses from this handler
}