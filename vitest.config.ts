import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Vitest config for unit/component tests (jsdom) and Convex function tests.
// Convex function tests (convex-test) run under the "edge-runtime"-like default
// node environment; component tests use jsdom.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@convex": path.resolve(__dirname, "./convex"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/unit/**/*.test.{ts,tsx}", "tests/convex/**/*.test.ts"],
    // convex-test spins up an in-memory backend per test; under load (e.g. a
    // concurrent build or a live `convex dev`) a multi-user call test can brush
    // the 5s default. Raise the ceiling so environmental contention doesn't
    // read as a failure, while still catching genuine hangs.
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
});
