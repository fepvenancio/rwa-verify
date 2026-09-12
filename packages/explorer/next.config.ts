import type { NextConfig } from "next";

// @rwa-verify/readers is consumed from source (tsconfig paths) and uses NodeNext-style `./x.js` imports for `.ts`
// files. Turbopack has no extensionAlias, so the app builds with webpack (`next build --webpack`).
const nextConfig: NextConfig = {
  webpack: (config) => {
    config.resolve.extensionAlias = { ".js": [".ts", ".js"] };
    return config;
  },
};

export default nextConfig;
