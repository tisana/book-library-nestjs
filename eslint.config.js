/* eslint-disable @typescript-eslint/no-require-imports */
const tseslint = require('@typescript-eslint/eslint-plugin');
const prettierConfig = require('eslint-config-prettier');

const tsFiles = ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'];

module.exports = [
  {
    ignores: ['coverage/**', 'dist/**', 'node_modules/**'],
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
