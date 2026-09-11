// @ts-check
import eslint from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import vitest from '@vitest/eslint-plugin';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores([
    'coverage/',
    'out/',
    '.next/',
    '.vercel/',
    'training/',
    'playwright-report/',
    'test-results/',
    'next-env.d.ts',
  ]),
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
  {
    files: ['app/**/*.{ts,tsx}', 'src/ui/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended, nextPlugin.configs['core-web-vitals']],
  },
  prettier,
);
