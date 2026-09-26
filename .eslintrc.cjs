/* eslint-env node */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2022, sourceType: 'module', ecmaFeatures: { jsx: true } },
  env: { es2022: true, node: true, browser: true },
  plugins: ['@typescript-eslint', 'react-hooks'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'plugin:react-hooks/recommended'],
  ignorePatterns: ['out/', 'dist/', 'release/', 'node_modules/', 'program/', 'program-agents/', 'test-results/', 'playwright-report/'],
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    // Custom Rule 1: only src/renderer/src/engine/** may import ruleswright (type imports included).
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['ruleswright', 'ruleswright/*'],
            message: 'Only src/renderer/src/engine/** may import ruleswright (Custom Rule 1).',
          },
        ],
      },
    ],
    'no-restricted-syntax': [
      'error',
      { selector: "CallExpression[callee.name='eval']", message: 'no eval' },
      { selector: "NewExpression[callee.name='Function']", message: 'no new Function' },
    ],
    // Custom Rule 3: no nondeterminism.
    'no-restricted-properties': ['error', { object: 'Math', property: 'random', message: 'Custom Rule 3' }],
  },
  overrides: [
    {
      files: ['src/renderer/src/engine/**'],
      rules: {
        'no-restricted-imports': 'off',
        'no-restricted-properties': [
          'error',
          { object: 'Math', property: 'random', message: 'Custom Rule 3' },
          { object: 'Date', property: 'now', message: 'Custom Rule 3' },
        ],
      },
    },
    {
      // Tests and e2e compute expected values with the real library.
      files: ['tests/**', 'e2e/**'],
      rules: { 'no-restricted-imports': 'off' },
    },
  ],
};
