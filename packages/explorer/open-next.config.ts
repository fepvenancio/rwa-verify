import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// No ISR/incremental cache: every report is computed per request (Cache-Control: no-store).
export default defineCloudflareConfig({});
