import { getSecurityHeaders } from "./src/lib/security/headers.mjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: getSecurityHeaders({ production: process.env.NODE_ENV === "production" }) }];
  },
};

export default nextConfig;
