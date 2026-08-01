import vacker from '@vacker/config/eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  ...vacker,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
  {
    /*
     * Los scripts de `scripts/` corren en Node, pero adentro de
     * `page.evaluate()` el código se ejecuta en el navegador — ahí `document` y
     * compañía existen. ESLint analiza el archivo entero como Node y no tiene
     * forma de distinguir las dos mitades, así que se le declaran acá los
     * globales del navegador en vez de sembrar el archivo de excepciones.
     */
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: { document: 'readonly', window: 'readonly', NodeFilter: 'readonly' },
    },
  },
  {
    ignores: ['.next/**', '.next-e2e/**', 'next-env.d.ts'],
  },
];
