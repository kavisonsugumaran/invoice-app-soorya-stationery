import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default 1MB is too small for a logo image upload.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
