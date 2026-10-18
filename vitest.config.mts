import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mirrors the "@/*" path in tsconfig.json, so tests import like the app does.
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    // Tests cover pure logic in lib/ only (CLAUDE.md: no UI tests).
    include: ["lib/**/*.test.ts"],
    environment: "node",
  },
});
