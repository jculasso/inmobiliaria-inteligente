import { defineConfig, devices } from '@playwright/test';

/**
 * Tests end to end en un navegador de verdad.
 *
 * IMPORTANTE — no tocan la base. Hay dos tandas:
 *
 *  - Sin sesión (`acceso`, `sin-arrastre-lateral`): el middleware, las
 *    redirecciones y los archivos que el navegador pide sin estar logueado.
 *  - Con sesión (`alquileres/`): pantallas del módulo contra el SIMULADOR
 *    (`e2e/simulador/`), un proceso local que contesta como la API y como
 *    Supabase con datos de mentira validados contra los schemas Zod.
 *
 * La razón de no ir contra datos reales es concreta: la base de producción está
 * en el plan gratis de Supabase, que NO tiene backups automáticos. Por eso la
 * web de prueba se compila SIEMPRE con `e2e/entorno-de-prueba.env` (lo hace
 * `pnpm test:e2e`), que apunta al simulador, y `global-setup.ts` se niega a
 * correr si la compilación apunta a otro lado.
 *
 * Levanta la app en modo producción (`build` + `start`), que es lo que corre de
 * verdad — en `dev` el middleware y el cacheo se comportan distinto.
 */
const PUERTO = 3210;

/** Las pruebas con sesión: corren en escritorio y en el teléfono de 375px, no en el 430. */
const CON_SESION = /alquileres\/.*\.spec\.ts$/;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: `http://localhost:${PUERTO}`,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // El "baile" vivía únicamente en pantallas de teléfono, así que las
    // comprobaciones de ancho tienen que correr también acá.
    { name: 'mobile', use: { ...devices['iPhone 14 Pro Max'] }, testIgnore: CON_SESION },
    // El ancho donde las cosas se rompen es 375 (iPhone SE, 12 mini, 13 mini):
    // los iPhone modernos que trae Playwright miden 393 o 430, y probar en el
    // ancho cómodo no prueba nada. WebKit, como Safari en el iPhone.
    {
      name: 'telefono',
      use: { ...devices['iPhone SE'], viewport: { width: 375, height: 812 } },
      testMatch: CON_SESION,
    },
  ],
  webServer: [
    {
      // Nunca se reusa uno que ya esté corriendo: tiene que ser ESTE simulador.
      command: 'pnpm exec tsx e2e/simulador/servidor.ts',
      url: 'http://localhost:3291/__simulador',
      reuseExistingServer: false,
      timeout: 60_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      // Tampoco la app: una `next start` vieja podría estar compilada con el
      // `.env` de la raíz, que apunta a producción.
      command: `pnpm exec dotenv -o -e e2e/entorno-de-prueba.env -- next start --port ${PUERTO}`,
      url: `http://localhost:${PUERTO}`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
