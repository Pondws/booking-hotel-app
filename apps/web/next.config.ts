import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Internal workspace packages ship TypeScript source
  transpilePackages: ["@booking/ui", "@booking/shared"],
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    // Seeded hotel and room photos
    remotePatterns: [new URL("https://picsum.photos/**")],
  },
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
