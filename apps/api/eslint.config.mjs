import vacker from '@vacker/config/eslint';

export default [
  ...vacker,
  {
    rules: {
      // NestJS usa decoradores; los tipos de retorno explícitos no siempre aportan.
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },
];
