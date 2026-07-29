import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores:
    '.next/**',
    'node_modules/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'prisma/**',
    // Maintenance & utility scripts excluded from lint.
    '*.js',
    'scripts/**',
    'seed-branch.js',
    'check-railway-users.js',
    'cleanup.js',
    'verify-auth-data.js',
  ]),

  {
    files: ['.eslintignore'],
    ignores: ['.eslintignore'],
  },

  // SPEC FIX-20260729-01-BASELINE baseline-friendly rules:
  // - Allow `_`-prefixed unused imports / vars / catches across the whole tree
  //   so legacy fixtures, resets y Helpers privados no rompan el gate.
  // - Disable reglas referenciadas pero no definidas en el plugin set local
  //   para evitar fallos del runner (no-throw-literal, etc.).
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/no-throw-literal': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },

  // ─── Tests / specs overrides ────────────────────────────────────────────────
  // En tests relajamos reglas estructurales: any, require, <img>, exhaustive-deps
  // y set-state-in-effect son legítimos en fixtures y mocks.
  {
    files: [
      'tests/**/*',
      'src/**/__tests__/**',
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-throw-literal': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@next/next/no-img-element': 'off',
      'react-hooks/exhaustive-deps': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/set-state-in-effect': 'off',
      'react/no-unescaped-entities': 'off',
    },
  },

  {
    files: ['scripts/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'react-hooks/exhaustive-deps': 'off',
    },
  },
]);

export default eslintConfig;

