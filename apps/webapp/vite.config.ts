import path from 'node:path';
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const rootDir = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@smartfood/config/default-tenant': path.join(
        rootDir,
        'packages/config/src/default-tenant.ts',
      ),
      '@smartfood/shared': path.join(rootDir, 'packages/shared/src'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});
