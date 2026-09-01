import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Дублирует `paths` из tsconfig. `dirname`, а не `new URL('.')`: тот
      // отдаёт путь с хвостовым слэшем, и импорт разворачивается в двойной.
      '@': dirname(fileURLToPath(import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
  },
});
