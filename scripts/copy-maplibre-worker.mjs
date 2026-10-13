// Copies MapLibre GL JS's worker chunks into public/maplibre/ so they can be
// served as static assets and pointed at via setWorkerUrl() in MapView.tsx.
//
// Why this exists: maplibre-gl v6 ships pure ESM and constructs its tile-parsing
// Web Worker internally via `new Worker(new URL(..., import.meta.url), {type:
// "module"})`. Under Next.js 16 + Turbopack (dev mode, as of this writing),
// that import.meta.url-relative worker URL resolves incorrectly -- observed
// resolving to the page's own URL instead of the actual worker chunk -- so the
// worker never loads. Raster tile layers still render (no worker needed), but
// vector tile layers hang forever: MapLibre's 'load' event never fires because
// the vector source's tiles never finish parsing. Confirmed via a bare
// non-Next.js HTML page, where the identical maplibre-gl build works correctly.
//
// The fix: serve the worker chunk as a static asset and call
// `setWorkerUrl("/maplibre/maplibre-gl-worker.mjs")` before creating any Map.
// Runs on every `npm install` (see package.json postinstall) so it can't go
// stale if maplibre-gl is upgraded -- these are unminified filenames tied to
// the installed version, not vendored/committed source.
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(here, "..", "node_modules", "maplibre-gl", "dist");
const destDir = path.join(here, "..", "public", "maplibre");

const files = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];

if (!existsSync(srcDir)) {
  console.warn("[copy-maplibre-worker] maplibre-gl not installed yet, skipping.");
  process.exit(0);
}

mkdirSync(destDir, { recursive: true });
for (const file of files) {
  copyFileSync(path.join(srcDir, file), path.join(destDir, file));
}
console.log(`[copy-maplibre-worker] copied ${files.length} files to public/maplibre/`);
