import tseslint from '@typescript-eslint/eslint-plugin';
import parser from '@typescript-eslint/parser';

export default [
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { parser },
    plugins: { '@typescript-eslint': tseslint },
    rules: {
      // Keep files small and single-purpose. See plan.md Section 12.
      'max-lines': ['warn', { max: 500, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    // src/ledger is the pure model layer: no React, no I/O, no reaching into
    // store/transport/screens. See plan.md Section 2 and Section 12.
    files: ['src/ledger/**/*.{ts,tsx}'],
    languageOptions: { parser },
    plugins: { '@typescript-eslint': tseslint },
    rules: {
      'no-restricted-imports': ['error', {
        patterns: ['**/store/*', '**/transport/*', '**/app/*', 'react', 'react-native'],
      }],
    },
  },
];
