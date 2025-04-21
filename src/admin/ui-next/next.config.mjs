/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configure rewrites to proxy API requests to the Cloudflare Worker
  // during local development.
  async rewrites() {
    return [
      {
        source: '/admin/api/:path*', // Match all requests starting with /admin/api/
        destination: 'http://localhost:8787/admin/api/:path*', // Proxy them to the worker on port 8787
      },
    ];
  },
};

export default nextConfig;