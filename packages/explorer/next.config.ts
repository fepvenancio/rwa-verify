import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// @rwa-verify/sdk is consumed from source (tsconfig paths) and uses NodeNext-style `./x.js` imports for `.ts`
// files. Turbopack has no extensionAlias, so the app builds with webpack (`next build --webpack`).
const nextConfig: NextConfig = {
  webpack: (config) => {
    config.resolve.extensionAlias = { ".js": [".ts", ".js"] };
    return config;
  },
};

export default nextConfig;

// Makes Cloudflare bindings/vars available to `next dev` (no-op in production).
initOpenNextCloudflareForDev();
