import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Internal workspace packages ship TypeScript source
  transpilePackages: ["@booking/ui", "@booking/shared"],
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    remotePatterns: [
      // Seeded hotel and room photos
      new URL("https://picsum.photos/**"),
      // Images uploaded in web-admin (served by the API at /uploads/*)
      new URL(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/uploads/**`),
    ],
    // The API runs on localhost in dev; Next 16 refuses to optimize local-IP images unless allowed
    dangerouslyAllowLocalIP: process.env.NODE_ENV !== "production",
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
