import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["src/test/mobile-organization-rereview.test.tsx"],
  },
  resolve: {
    // Cross-client hook tests must use this renderer's React instance, just as
    // the web Vite config deduplicates React for shared workspace components.
    dedupe: ["react", "react-dom"],
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
});
