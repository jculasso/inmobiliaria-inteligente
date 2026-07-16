import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts', 'test/**/*.e2e-spec.ts'],
    root: '.',
  },
  // SWC compila los decoradores de NestJS (esbuild de Vitest no soporta
  // emitDecoratorMetadata), necesario para el arranque de la app en los tests.
  plugins: [swc.vite()],
});
