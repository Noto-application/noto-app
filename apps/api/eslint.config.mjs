import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
];
