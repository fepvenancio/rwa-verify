import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Mirrors the `paths` entries in tsconfig.json.
export default defineConfig({
  resolve: {
    alias: {
      "@rwa-verify/sdk": fileURLToPath(new URL("../sdk/src/index.ts", import.meta.url)),
      "@/": fileURLToPath(new URL("./src/", import.meta.url)),
    },
  },
  test: { include: ["src/**/*.test.ts"] },
});
