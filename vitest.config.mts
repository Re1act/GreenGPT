import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests only cover pure code (the simulator model). Nothing here may touch
// Supabase -- tests never load .env.local and never import lib/supabase/*.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
  },
});
