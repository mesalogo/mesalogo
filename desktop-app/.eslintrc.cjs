/**
 * ESLint config for the MesaLogo Electron desktop wrapper.
 *
 * The desktop app is plain CommonJS JS (main.js, preload.js) — no bundler,
 * no TypeScript — so we use ESLint's legacy `.eslintrc.cjs` (still fully
 * supported in ESLint 8.x) and target the Node/Electron runtime explicitly.
 *
 * Why each section exists is annotated inline. The point of this file is
 * to give an autonomous agent (or human) a single command — `pnpm lint` —
 * that catches the kinds of bugs Electron's `main.js` is most likely to
 * grow over time: stray `var`, == vs ===, unused vars, accidental
 * `eval`/`new Function`, and files that have crept past a sane size.
 */
module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
    browser: false,
    commonjs: true,
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'script',
  },
  extends: ['eslint:recommended'],
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'build/',
    'release/',
    'icons/',
    'docs/',
    '*.example',
    'build-mac.sh.example',
    'config.json.example',
    'package-lock.json',
    'pnpm-lock.yaml',
  ],
  rules: {
    // Catch == vs === sloppiness early; the single most common JS footgun.
    eqeqeq: ['error', 'always'],

    // Modern Electron supports let/const everywhere; var hoisting causes bugs.
    'no-var': 'error',
    'prefer-const': 'warn',

    // Allow `_`-prefixed args/locals as intentional discards
    // (common in IPC handlers and Electron callbacks).
    'no-unused-vars': [
      'warn',
      {
        args: 'after-used',
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      },
    ],

    // Electron main process logs to stderr by design; don't block on console.
    'no-console': 'off',
    'no-process-exit': 'off',

    // Electron security best-practices: never accept code from string sources.
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',

    // Catch overgrown files early. 1500 is generous (main.js is ~715 lines today).
    'max-lines': [
      'warn',
      {
        max: 1500,
        skipBlankLines: true,
        skipComments: true,
      },
    ],

    // Soft guardrail; complements main.js's many IPC handlers.
    complexity: ['warn', 20],

    'no-undef': 'error',
    'no-useless-escape': 'warn',
    'no-empty': ['error', { allowEmptyCatch: true }],
  },
  overrides: [
    {
      files: ['preload.js'],
      env: { browser: true, node: true },
    },
    {
      files: ['build/*.js', 'scripts/*.js'],
      rules: { 'no-unused-vars': 'off' },
    },
  ],
};
