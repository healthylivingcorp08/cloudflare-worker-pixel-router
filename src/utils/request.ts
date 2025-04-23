// Placeholder for request utility functions

export function getCookie(request: Request, name: string): string | null {
    // Basic implementation (replace with more robust logic if needed)
    const cookieHeader = request.headers.get('Cookie');
    if (!cookieHeader) return null;
    const cookies = cookieHeader.split(';');
    for (const cookie of cookies) {
        const [cookieName, cookieValue] = cookie.trim().split('=');
        if (cookieName === name) {
            return decodeURIComponent(cookieValue);
        }
    }
    return null;
}

export function getQueryParam(request: Request, name: string): string | null {
    const url = new URL(request.url);
    return url.searchParams.get(name);
}