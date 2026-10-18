import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mirrors the "@/*" path in tsconfig.json, so tests import like the app does.
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    // Pure logic in lib/, plus checks that the seed data still shows its scenarios. No UI tests.
    include: ["lib/**/*.test.ts", "data/**/*.test.ts"],
    environment: "node",
  },
});
