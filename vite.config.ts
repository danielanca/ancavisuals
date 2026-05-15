import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import type { UserConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { Agent } from "node:http";

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
const backendAgent = new Agent({ keepAlive: true, maxSockets: 50 });
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      src: fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 3000,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:1994",
        changeOrigin: true,
        agent: backendAgent,
      },
      "/triggerEvent": {
        target: "http://127.0.0.1:1994",
        changeOrigin: true,
        agent: backendAgent,
      },
    },
  },
  ssr: {
    noExternal: ["react-helmet-async"],
  },
  build: {
    minify: false,
  },
  test,
});
