// @vacker/config — configuración ESLint 9 (flat) compartida.
// Consumo en cada paquete:
//   import vacker from '@vacker/config/eslint';
//   export default [...vacker, /* overrides locales */];
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/.turbo/**',
      // Temporales que tsup crea y borra durante el build; si eslint corre en
      // paralelo puede intentar leer uno ya borrado (ENOENT) y romper el CI.
      '**/tsup.config.bundled_*.mjs',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  // Prettier al final: desactiva reglas de formato que colisionan.
  prettier,
];
