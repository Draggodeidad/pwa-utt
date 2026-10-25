import tsParser from "@typescript-eslint/parser";

// Correctness checks only: no formatting or changes to application conventions.
export default [
  {
    ignores: [
      "node_modules/**", ".next/**", "out/**", "coverage/**",
      "test-results/**", "playwright-report/**", "public/sw-build.js",
    ],
  },
  {
    files: ["**/*.{js,cjs,mjs,ts,tsx}"],
    rules: {
      "constructor-super": "error",
      "no-async-promise-executor": "error",
      "no-compare-neg-zero": "error",
      "no-constant-binary-expression": "error",
      "no-dupe-args": "error",
      "no-dupe-else-if": "error",
      "no-dupe-keys": "error",
      "no-duplicate-case": "error",
      "no-ex-assign": "error",
      "no-fallthrough": "error",
      "no-self-assign": "error",
      "no-this-before-super": "error",
      "no-unexpected-multiline": "error",
      "no-unreachable": "error",
      "no-unsafe-finally": "error",
      "no-unsafe-negation": "error",
      "use-isnan": "error",
      "valid-typeof": "error",
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { parser: tsParser },
  },
];
