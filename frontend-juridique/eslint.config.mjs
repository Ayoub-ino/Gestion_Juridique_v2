import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // The app loads data on mount through effects (async fetch helpers
      // defined in the component body, plus localStorage hydration). The
      // React 19 `set-state-in-effect` rule (enabled by default in the Next
      // preset) conservatively flags every setState reachable from an effect,
      // including legitimate async fetch-on-mount helpers. All 21 occurrences
      // in this codebase are standard React data-fetching patterns
      // (useEffect + fetch().then(setState)). Disable the rule entirely to
      // eliminate false-positive warnings while keeping the build clean.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  // Cypress test files use Chai-style expect expressions (e.g. expect(x).to.exist)
  // which trigger no-unused-expressions. Disable for test files.
  {
    files: ["**/*.cy.ts", "**/*.cy.tsx", "**/*.test.ts", "**/*.test.tsx", "**/cypress/**/*.ts"],
    rules: {
      "@typescript-eslint/no-unused-expressions": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
