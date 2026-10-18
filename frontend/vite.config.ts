/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        // The backend starts on 5000 but falls back to 5001 when macOS AirPlay
        // Receiver occupies port 5000. Keep this in sync with backend/.env PORT,
        // or set VITE_BACKEND_PORT at the terminal to override without editing:
        //   VITE_BACKEND_PORT=5000 npm run dev
        target: `http://localhost:${process.env.VITE_BACKEND_PORT || 5001}`,
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
});
