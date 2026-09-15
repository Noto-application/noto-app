import baseConfig from '../../eslint.config.mjs';
import tseslint from 'typescript-eslint';

export default [
  ...baseConfig,
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    ...tseslint.configs.disableTypeChecked,
    files: ['test/run-e2e.mjs'],
  },
];
