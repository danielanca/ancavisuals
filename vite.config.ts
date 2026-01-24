import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import type { UserConfig } from 'vitest/config';

// Test config
const test = {
  globals: true,
  environment: 'jsdom',
  setupFiles: ['src/__tests__/setupTests.ts'],
  threads: false,
  watch: false,
} as UserConfig['test'];

// https://vitejs.dev/config/
const isProd = process.env.NODE_ENV === 'production';

export default defineConfig({
  plugins: [react()],

  // Server config: HTTPS only in production or if explicitly enabled
  server: {
    https: isProd ? {
      key: fs.readFileSync('./localhost-key.pem'), // you can remove these lines if you don't have certs
      cert: fs.readFileSync('./localhost.pem'),
    } : false,
    host: 'localhost',
    port: 3000,
  },

  // SSR config
  ssr: {
    noExternal: ['react-helmet-async'],
  },

  // Build config
  build: {
    minify: isProd,
  },

  // Vitest config
  test,
});