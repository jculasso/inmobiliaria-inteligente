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
    ignores: ['.next/**', 'next-env.d.ts'],
  },
];
