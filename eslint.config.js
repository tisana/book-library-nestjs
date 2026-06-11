/* eslint-disable @typescript-eslint/no-require-imports */
const tseslint = require('@typescript-eslint/eslint-plugin');
const prettierConfig = require('eslint-config-prettier');

const tsFiles = ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'];

module.exports = [
  {
    ignores: [
      'coverage/**',
      'dist/**',
      'build/**',
      'node_modules/**',
      'frontend/coverage/**',
      'frontend/dist/**',
      'frontend/node_modules/**',
      'frontend/test-results/**',
      'frontend/playwright-report/**',
    ],
  },
  ...tseslint.configs['flat/recommended'],
  {
    files: tsFiles,
    rules: {
      ...prettierConfig.rules,
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];
