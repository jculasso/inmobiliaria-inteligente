import { defineConfig, devices } from '@playwright/test';

/**
 * Tests end to end en un navegador de verdad.
 *
 * IMPORTANTE — no tocan la base. Esta primera tanda cubre solo lo que se puede
 * verificar SIN sesión, que da la casualidad de que es donde más veces se rompió
 * algo: el middleware, las redirecciones y los archivos que el navegador pide
 * sin estar logueado.
 *
 * La razón de no ir contra datos reales es concreta: la base de producción está
 * en el plan gratis de Supabase, que NO tiene backups automáticos. Un test que
 * cree y borre filas no puede apuntar ahí. Los flujos con sesión van a necesitar
 * una base aparte; hasta entonces, el camino API + base está cubierto por los
 * tests de la API (incluido el de aislamiento entre inmobiliarias).
 *
 * Levanta la app en modo producción (`build` + `start`), que es lo que corre de
 * verdad — en `dev` el middleware y el cacheo se comportan distinto.
 */
const PUERTO = 3210;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PUERTO}`,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // El "baile" vivía únicamente en pantallas de teléfono, así que las
    // comprobaciones de ancho tienen que correr también acá.
    { name: 'mobile', use: { ...devices['iPhone 14 Pro Max'] } },
  ],
  webServer: {
    command: `pnpm exec next start --port ${PUERTO}`,
    url: `http://localhost:${PUERTO}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
