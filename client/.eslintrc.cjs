module.exports = {
  root: true,
  env: { browser: true, es2020: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: [
    'dist',
    'node_modules',
    'test-results',
    'playwright-report',
    '.eslintrc.cjs',
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
  },
  overrides: [
    {
      // shadcn/ui primitives export their cva variants alongside the
      // component, and context modules export their hooks alongside the
      // provider. Both are intentional and don't affect Fast Refresh in
      // practice, so the DX-only rule is disabled for these paths.
      files: ['src/components/ui/**/*.{ts,tsx}', 'src/contexts/**/*.{ts,tsx}'],
      rules: {
        'react-refresh/only-export-components': 'off',
      },
    },
  ],
}
