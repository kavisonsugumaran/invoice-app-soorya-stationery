import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev-mode route indicator overlay is dev-server-only (absent in
  // production either way) but it sits outside our component tree, so no
  // print:hidden class we write can reach it — it leaked into local print
  // testing as a spurious blank page. Off entirely rather than worked around.
  devIndicators: false,
  experimental: {
    serverActions: {
      // Default 1MB is too small for a logo image upload.
      bodySizeLimit: "4mb",
    },
  },
  // dictionary-en reads its data files via fs.readFile(new URL(..., import.meta.url)),
  // which breaks under Turbopack's server bundling (import.meta.url no longer points
  // to a real filesystem path once bundled). Excluding it here makes Next load it via
  // native Node require instead, so that file read resolves correctly.
  serverExternalPackages: ["dictionary-en"],
};

export default nextConfig;
