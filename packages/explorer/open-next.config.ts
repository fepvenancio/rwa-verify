import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// Prerendered pages (e.g. /about) are served from the static assets bundle; nothing is written at runtime.
// Report pages are dynamic per request (Cache-Control: no-store).
export default defineCloudflareConfig({ incrementalCache: staticAssetsIncrementalCache });
