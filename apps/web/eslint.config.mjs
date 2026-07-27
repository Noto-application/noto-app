import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import prettierConfig from 'eslint-config-prettier';

import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  ...nextCoreWebVitals,
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      react: {
        version: '19.2.8',
      },
    },
  },
  prettierConfig,
];
