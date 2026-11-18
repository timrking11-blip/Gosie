import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/test/mobile-organization-rereview.test.tsx"],
  },
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      "react-native": path.resolve(import.meta.dirname, "./src/test/react-native-simulator.tsx"),
      "react-native-safe-area-context": path.resolve(import.meta.dirname, "./src/test/safe-area-simulator.tsx"),
    },
  },
});
