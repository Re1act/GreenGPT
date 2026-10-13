import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored, minified maplibre-gl worker chunks copied by
    // scripts/copy-maplibre-worker.mjs (see MapView.tsx for why) -- not
    // authored code, regenerated on every install.
    "public/maplibre/**",
  ]),
]);

export default eslintConfig;
