import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  // Same-origin API proxy: the browser only ever talks to this app's origin (:3100) at /api/*,
  // and Next forwards to the backend over the internal network. This keeps the auth cookies
  // FIRST-PARTY to the app origin — eliminating the cross-origin/SameSite cookie failures that
  // logged users out. SSR still calls the backend directly via API_URL_INTERNAL.
  async rewrites() {
    const backend = process.env.BACKEND_ORIGIN ?? 'http://localhost:4000';
    return [{ source: '/api/:path*', destination: `${backend}/api/:path*` }];
  },
};

export default nextConfig;
