import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.e2b.app", "192.168.100.144"],
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/icon" }];
  },
};

export default nextConfig;
