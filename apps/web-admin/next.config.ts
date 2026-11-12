import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Internal workspace packages ship TypeScript source
  transpilePackages: ["@booking/ui", "@booking/shared"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
