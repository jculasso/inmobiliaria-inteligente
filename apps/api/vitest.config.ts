import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

// Carga el .env de la raíz del monorepo SOLO si existe (dev local). En CI sin
// credenciales no falla: los tests que tocan la DB se saltean por su propio gate.
const envPath = resolve(import.meta.dirname, '../../.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (!(key in process.env)) process.env[key] = val;
  }
}

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx', 'test/**/*.e2e-spec.ts'],
    root: '.',
  },
  // SWC compila los decoradores de NestJS (esbuild de Vitest no soporta
  // emitDecoratorMetadata), necesario para el arranque de la app en los tests.
  plugins: [swc.vite()],
});
