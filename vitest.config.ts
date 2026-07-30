import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    // Integration test files share one real Postgres database and each
    // wipes all tables in beforeEach — running files in parallel races
    // each other's resetDb() calls, causing spurious FK violations.
    fileParallelism: false,
  },
});
