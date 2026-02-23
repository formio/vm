import tseslint from 'typescript-eslint';
import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
  js.configs.recommended,
  eslintConfigPrettier,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    ignores: ['dist/**'],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      'no-prototype-builtins': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          ignoreRestSiblings: true,
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^ignore',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
];
