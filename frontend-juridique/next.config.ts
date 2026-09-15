import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable output file tracing for smaller standalone builds
  output: "standalone",

  // Compress responses (gzip/brotli)
  compress: true,

  // Optimize package imports — tree-shake large libraries
  experimental: {
    optimizePackageImports: ["lucide-react", "@heroicons/react"],
  },

  // Externalize heavy packages from the server bundle (not needed in SSR)
  serverExternalPackages: ["mammoth", "pdfjs-dist", "xlsx"],

  // The dev-tools badge is a fixed-position overlay that covers sidebar controls
  // and breaks E2E interactions, so it is turned off.
  devIndicators: false,
};

export default nextConfig;
