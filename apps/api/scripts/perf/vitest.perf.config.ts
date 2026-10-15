import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

/**
 * Configuración aparte para la prueba de volumen de Alquileres. No carga el
 * `.env` de la raíz —a diferencia de `vitest.config.ts`—: la base sale SOLO de
 * `PERF_DATABASE_URL`, y `harness.ts` rechaza cualquier host que no sea local.
 *
 *   PERF_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54329/perf \
 *     pnpm --filter @vacker/api exec vitest run --config scripts/perf/vitest.perf.config.ts sembrar
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['scripts/perf/*.perf.ts'],
    root: '.',
    testTimeout: 60 * 60_000,
    hookTimeout: 10 * 60_000,
    fileParallelism: false,
  },
  plugins: [swc.vite()],
});
