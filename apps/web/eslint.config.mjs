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
     * `page.evaluate()` el código se ejecuta en el navegador — ahí `document`
     * existe. ESLint analiza el archivo entero como Node y no puede distinguir
     * las dos mitades. Mismo criterio que en apps/sitio.
     */
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: { document: 'readonly', window: 'readonly' },
    },
  },
  {
    ignores: ['.next/**', 'next-env.d.ts'],
  },
];
