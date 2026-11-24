/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load environment variables across frontend, root, and backend
  const env = {
    ...loadEnv(mode, path.resolve(__dirname, '..'), ''),
    ...loadEnv(mode, path.resolve(__dirname, '../backend'), ''),
    ...loadEnv(mode, process.cwd(), ''),
    ...process.env,
  };

  const getBackendPort = (): number => {
    // 1. Explicit VITE_BACKEND_PORT override (terminal or .env)
    if (env.VITE_BACKEND_PORT) {
      const p = Number(env.VITE_BACKEND_PORT);
      if (!isNaN(p) && p > 0) return p;
    }
    // 2. Explicit BACKEND_PORT override
    if (env.BACKEND_PORT) {
      const p = Number(env.BACKEND_PORT);
      if (!isNaN(p) && p > 0) return p;
    }
    // 3. Dynamic port file written by running CareConnect backend server
    const candidatePortPaths = [
      path.resolve(__dirname, '../.backend-port'),
      path.resolve(process.cwd(), '.backend-port'),
      path.resolve(process.cwd(), '../.backend-port'),
    ];
    for (const portPath of candidatePortPaths) {
      if (fs.existsSync(portPath)) {
        try {
          const fileContent = fs.readFileSync(portPath, 'utf-8').trim();
          const filePort = Number(fileContent);
          if (!isNaN(filePort) && filePort > 0) return filePort;
        } catch {
          // ignore read error
        }
      }
    }
    // 4. PORT from backend environment if present (excluding common frontend ports)
    if (env.PORT) {
      const p = Number(env.PORT);
      if (!isNaN(p) && p > 0 && p !== 5173 && p !== 5174 && p !== 5175) return p;
    }
    // 5. Default fallback to 5001
    return 5001;
  };

  const initialBackendPort = getBackendPort();

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': '/src',
      },
    },
    server: {
      port: Number(process.env.FRONTEND_PORT) || 5173,
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${initialBackendPort}`,
          changeOrigin: true,
          router: () => {
            const currentPort = getBackendPort();
            return `http://127.0.0.1:${currentPort}`;
          },
        },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
    },
  };
});
