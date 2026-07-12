import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

// The API proxy has to be declared for `server` and `preview` separately — Vite
// does not share one between them, and the Playwright e2e run is served by
// `vite preview`, so without this every /api call in e2e would 404.
const apiProxy = {
  '/api': {
    target: 'http://localhost:3001',
    changeOrigin: true,
  },
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@life-admin/shared": path.resolve(__dirname, "../packages/shared/src/index.ts"),
    },
  },
  server: {
    port: 3000,
    proxy: apiProxy,
  },
  preview: {
    port: 4173,
    proxy: apiProxy,
  },
  test: {
    // jsdom so React component tests can render against a DOM.
    environment: 'jsdom',
    // Use explicit imports (describe/it/expect) rather than globals so ESLint's
    // no-undef stays happy and the production tsconfig needn't pull in test types.
    globals: false,
    setupFiles: './src/test/setup.ts',
    // e2e/ is owned by Playwright; keep Vitest to unit tests under src/.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
