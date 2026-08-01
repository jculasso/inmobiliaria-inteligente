import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    // Entorno de Node y no jsdom: acá lo único con lógica es el endpoint del
    // formulario, que corre en el servidor. La página es texto y maquetación.
    environment: 'node',
    include: ['app/**/*.test.ts'],
  },
});
