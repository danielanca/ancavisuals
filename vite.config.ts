import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import type { UserConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const test = {
  globals: true,
  environment: "jsdom",
  setupFiles: ["tests/vitest/setupTests.ts"],
  include: ["tests/vitest/**/*.test.{ts,tsx}"],
  coverage: {
    reportsDirectory: "reports/coverage",
  },
  threads: false,
  watch: false,
} as UserConfig["test"];

// https://vitejs.dev/config/
const isProd = process.env.NODE_ENV === "production";
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      src: fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 3000,
  },
  ssr: {
    noExternal: ["react-helmet-async"],
  },
  build: {
    minify: false,
  },
  test,
});
