import coreWebVitals from 'eslint-config-next/core-web-vitals';

const eslintConfig = [
  ...coreWebVitals,
  {
    ignores: ['.next/**', 'node_modules/**', 'out/**'],
  },
];

export default eslintConfig;
