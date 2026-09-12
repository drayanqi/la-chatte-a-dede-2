import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 3000,
    open: true,
    // Proxy API calls to the Laravel backend so the SPA can use same-origin
    // '/api' requests in development and E2E runs. API_URL points at the API
    // root (e.g. http://localhost:8000/api) - strip the /api suffix for the
    // proxy target.
    proxy: {
      '/api': {
        target: (process.env.API_URL || 'http://127.0.0.1:8000/api').replace(/\/api\/?$/, ''),
        changeOrigin: true,
      },
    },
  },
});
