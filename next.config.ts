import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Arena's live preview is served from a dynamic *.e2b.app origin.
  allowedDevOrigins: ["*.e2b.app"],
};

export default nextConfig;
