// @ts-check
import eslint from '@eslint/js';
import vitest from '@vitest/eslint-plugin';
import prettier from 'eslint-config-prettier';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores(['coverage/', 'out/', '.next/', '.wrangler/', 'training/', 'playwright-report/']),
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // This codebase chooses its unit deliberately: code units for offsets,
      // code points via spread, grapheme clusters via Intl.Segmenter
      // (graphemes.ts). Spreading a string is always the code-point choice.
      '@typescript-eslint/no-misused-spread': [
        'error',
        { allow: [{ from: 'lib', name: 'string' }] },
      ],
    },
  },
  {
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    files: ['**/*.test.ts'],
    extends: [vitest.configs.recommended],
  },
  prettier,
);
