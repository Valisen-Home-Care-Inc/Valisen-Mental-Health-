import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextVitals,
  {
    rules: {
      // Existing components intentionally initialize browser-derived state in
      // mount effects. Keep that valid while retaining the rest of the modern
      // React hooks and purity checks from Next's strict preset.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "artifacts/**",
    "build/**",
    "coverage/**",
    "node_modules/**",
    "out/**",
    "next-env.d.ts",
  ]),
]);
