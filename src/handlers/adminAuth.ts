import { Env } from '../types';
import { ExecutionContext } from '@cloudflare/workers-types';
import { addCorsHeaders } from '../middleware/cors'; // Assuming CORS middleware exists
import { sign } from '@tsndr/cloudflare-worker-jwt'; // Import the sign function

/**
 * Generates a JWT token using HS256 algorithm.
 */
async function generateJwtToken(username: string, secret: string): Promise<string> {
    console.log('[Auth] Generating JWT token...');
    const payload = {
        sub: username, // Subject (standard claim)
        iat: Math.floor(Date.now() / 1000), // Issued At (standard claim)
        exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24), // Expiration Time: 24 hours (standard claim)
        // Add custom claims if needed, e.g., role
        custom: { role: 'admin' } // Assign 'admin' role on successful login
    };
    const token = await sign(payload, secret); // Use the sign function
    console.log('[Auth] JWT token generated.');
    return token;
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