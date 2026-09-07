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
};

export default nextConfig;
