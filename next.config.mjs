import { getSecurityHeaders } from "./src/lib/security/headers.mjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Next replaces this reference in the compiled route. Runtime env cannot
  // relabel an existing build; ordinary builds without identity stay unhealthy.
  env: { W10_COMMIT_SHA: process.env.W10_BUILD_SHA ?? "" },
  async headers() {
    return [{ source: "/:path*", headers: getSecurityHeaders({ production: process.env.NODE_ENV === "production" }) }];
  },
};

export default nextConfig;
