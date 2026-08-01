import { defineConfig, devices } from '@playwright/test';

/**
 * Tests de navegador del sitio comercial.
 *
 * Acá no hay base de datos ni sesión: el sitio es cinco páginas y un
 * formulario. Eso lo vuelve el lugar más barato del proyecto para tener
 * cobertura de navegador de verdad, y el que más la necesita — es lo primero
 * que ve un prospecto, y si en su teléfono se arrastra de costado, la
 * conversación empieza perdida.
 *
 * El proyecto `telefono` fija 375px a mano en vez de usar un dispositivo de la
 * lista: los iPhone modernos que trae Playwright miden 393 o 430, y el ancho
 * donde las cosas se rompen es 375. Probar en el ancho cómodo no prueba nada.
 *
 * Corre contra `next start` (producción) y no contra `dev`: es lo que se
 * despliega, y además es el único modo donde se puede comprobar que los
 * recuadros de "captura pendiente" efectivamente no se ven.
 */
const PUERTO = 3310;

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
    { name: 'escritorio', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    {
      name: 'telefono',
      use: { ...devices['iPhone SE'], viewport: { width: 375, height: 812 } },
    },
  ],
  webServer: {
    command: `pnpm exec next start --port ${PUERTO}`,
    url: `http://localhost:${PUERTO}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
