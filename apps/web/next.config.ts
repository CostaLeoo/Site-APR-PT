import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  async rewrites() {
    if (process.env.VERCEL_SERVICES_ROUTING === "true") return [];
    const target = process.env.API_INTERNAL_ORIGIN ?? "http://127.0.0.1:4000";
    return [
      { source: "/v1/:path*", destination: `${target}/v1/:path*` },
      { source: "/auth/:path*", destination: `${target}/auth/:path*` },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Permissions-Policy", value: "geolocation=(), microphone=()" },
        ],
      },
    ];
  },
};
export default config;
