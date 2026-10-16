import { setWorkerUrl } from "maplibre-gl";

// Shared by every MapLibre map in the app (the national map and the simulator's
// mini-map). Import this module before constructing a Map.

// Free, no-API-key vector basemap -- see https://openfreemap.org. This app
// never needs a styled/branded basemap, just recognizable coastlines/borders
// under the data layers, so a hosted free style is the right call over
// standing up tile infrastructure.
export const BASEMAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

// Under Next.js 16 + Turbopack (dev, as of this writing), maplibre-gl's
// internal Worker(new URL(..., import.meta.url)) construction resolves to the
// wrong URL (observed resolving to the page's own URL), so its tile-parsing
// worker never loads -- vector tile layers then hang forever (raster layers
// still render fine, since those don't need the worker), and 'load' never
// fires. Pointing at a statically-served copy of the worker chunk (kept in
// sync by scripts/copy-maplibre-worker.mjs, see that file for the full
// writeup) works around it. Must run before the first Map is constructed.
setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
