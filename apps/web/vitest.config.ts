import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // El segundo patrón toma los tests que viven en la raíz — hoy el del
    // matcher del middleware, que es justamente donde no queremos sorpresas.
    include: ['{app,lib,components}/**/*.test.{ts,tsx}', '*.test.{ts,tsx}'],
  },
});
