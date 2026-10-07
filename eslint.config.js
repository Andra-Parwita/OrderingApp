import { existsSync, readdirSync } from 'node:fs';
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import { createNodeResolver, importX } from 'eslint-plugin-import-x';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Layer rules (D-003): app -> features -> components -> ui -> theme; shared/ is importable by all.
const zone = (target, from, message, except) => ({ target, from, message, except });

const featureNames = existsSync('./src/features')
  ? readdirSync('./src/features', { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
  : [];

const layerZones = [
  zone(
    './src/ui',
    ['./src/components', './src/features', './src/app'],
    'ui may not import components, features or app',
  ),
  zone(
    './src/components',
    ['./src/features', './src/app'],
    'components may not import features or app',
  ),
  zone('./src/features', './src/app', 'features may not import app'),
  zone('./src', './worker', 'src and worker never import each other'),
  zone('./worker', './src', 'src and worker never import each other'),
  zone('./shared', ['./src', './worker'], 'shared imports nothing from src or worker'),
  // One feature may not import another feature.
  ...featureNames.map((name) =>
    zone(`./src/features/${name}`, './src/features', 'a feature may not import another feature', [
      `./${name}`,
    ]),
  ),
];

export default tseslint.config(
  {
    ignores: [
      'dist',
      '.wrangler',
      'node_modules',
      'captures',
      'scratch',
      'test-results',
      'playwright-report',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { 'react-hooks': reactHooks, 'import-x': importX },
    settings: {
      'import-x/extensions': ['.ts', '.tsx', '.js', '.jsx'],
      'import-x/parsers': { '@typescript-eslint/parser': ['.ts', '.tsx'] },
      'import-x/resolver-next': [
        createNodeResolver({ extensions: ['.ts', '.tsx', '.js', '.json'] }),
      ],
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/array-type': ['error', { default: 'generic' }],
      'import-x/no-cycle': 'error',
      'import-x/no-default-export': 'error',
      'import-x/no-restricted-paths': ['error', { zones: layerZones }],
    },
  },
  {
    // Tools and the Worker runtime require default exports.
    files: ['*.config.{js,ts}', 'worker/index.ts'],
    rules: { 'import-x/no-default-export': 'off' },
  },
  { files: ['**/*.js'], extends: [tseslint.configs.disableTypeChecked] },
  prettier,
);
