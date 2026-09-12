import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Mirrors the `paths` entry in tsconfig.json: readers is consumed from source, not from dist/.
export default defineConfig({
  resolve: { alias: { "@rwa-verify/readers": fileURLToPath(new URL("../readers/src/index.ts", import.meta.url)) } },
});
