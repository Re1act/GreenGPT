"use client";

import { useEffect, useRef, useState } from "react";
import {
  MapLibreMap,
  NavigationControl,
  Popup,
  setWorkerUrl,
  type MapLayerMouseEvent,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  droughtFillColorExpression,
  egridFillColorExpression,
  electricityPriceFillColorExpression,
  electricityPriceFillOpacityExpression,
  facilityCircleColorExpression,
  waterStressFillColorExpression,
} from "@/lib/map/colors";
import { buildFacilityPopupHtml, type FacilityProperties } from "@/lib/map/facilityPopup";
import OverlayControl, { type OverlayKey } from "@/components/map/OverlayControl";

// Free, no-API-key vector basemap -- see https://openfreemap.org. This app
// never needs a styled/branded basemap, just recognizable coastlines/borders
// under the data layers, so a hosted free style is the right call over
// standing up tile infrastructure.
const BASEMAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

const OVERLAY_LAYER_IDS: Record<Exclude<OverlayKey, "none">, string> = {
  "water-stress": "water-stress-fill",
  drought: "drought-fill",
  egrid: "egrid-fill",
  "electricity-price": "electricity-price-fill",
};

async function fetchGeoJson(path: string): Promise<GeoJSON.FeatureCollection> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return res.json();
}

// Under Next.js 16 + Turbopack (dev, as of this writing), maplibre-gl's
// internal Worker(new URL(..., import.meta.url)) construction resolves to the
// wrong URL (observed resolving to the page's own URL), so its tile-parsing
// worker never loads -- vector tile layers then hang forever (raster layers
// still render fine, since those don't need the worker), and 'load' never
// fires. Pointing at a statically-served copy of the worker chunk (kept in
// sync by scripts/copy-maplibre-worker.mjs, see that file for the full
// writeup) works around it. Must run before the first Map is constructed.
setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

export default function MapView() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const [overlay, setOverlay] = useState<OverlayKey>("none");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  // Keep layer visibility in sync with the selected overlay without re-adding
  // sources/layers -- only one overlay is meant to be visible at a time so
  // stacked choropleths don't turn to mud.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready") return;
    for (const [key, layerId] of Object.entries(OVERLAY_LAYER_IDS)) {
      if (!map.getLayer(layerId)) continue;
      map.setLayoutProperty(layerId, "visibility", key === overlay ? "visible" : "none");
    }
  }, [overlay, status]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: BASEMAP_STYLE,
      center: [-98.5, 39.5],
      zoom: 3.6,
      minZoom: 2.5,
      maxZoom: 12,
    });
    mapRef.current = map;
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");

    let cancelled = false;

    map.on("load", async () => {
      try {
        const [facilities, waterStress, drought, egrid, electricityPrice] = await Promise.all([
          fetchGeoJson("/api/map/facilities"),
          fetchGeoJson("/api/map/water-stress"),
          fetchGeoJson("/api/map/drought"),
          fetchGeoJson("/api/map/egrid"),
          fetchGeoJson("/api/map/electricity-price"),
        ]);
        if (cancelled) return;

        map.addSource("water-stress", { type: "geojson", data: waterStress });
        map.addLayer({
          id: OVERLAY_LAYER_IDS["water-stress"],
          type: "fill",
          source: "water-stress",
          layout: { visibility: "none" },
          paint: { "fill-color": waterStressFillColorExpression, "fill-opacity": 0.65 },
        });

        map.addSource("drought", { type: "geojson", data: drought });
        map.addLayer({
          id: OVERLAY_LAYER_IDS.drought,
          type: "fill",
          source: "drought",
          layout: { visibility: "none" },
          paint: { "fill-color": droughtFillColorExpression, "fill-opacity": 0.65 },
        });

        map.addSource("egrid", { type: "geojson", data: egrid });
        map.addLayer({
          id: OVERLAY_LAYER_IDS.egrid,
          type: "fill",
          source: "egrid",
          layout: { visibility: "none" },
          paint: { "fill-color": egridFillColorExpression, "fill-opacity": 0.65 },
        });

        map.addSource("electricity-price", { type: "geojson", data: electricityPrice });
        map.addLayer({
          id: OVERLAY_LAYER_IDS["electricity-price"],
          type: "fill",
          source: "electricity-price",
          layout: { visibility: "none" },
          paint: {
            "fill-color": electricityPriceFillColorExpression,
            "fill-opacity": electricityPriceFillOpacityExpression,
          },
        });

        // Facilities go on top of every overlay, always visible: the point
        // layer is the map's one constant, overlays are the toggleable context.
        map.addSource("facilities", { type: "geojson", data: facilities });
        map.addLayer({
          id: "facilities-circle",
          type: "circle",
          source: "facilities",
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 3, 8, 7, 12, 11],
            "circle-color": facilityCircleColorExpression,
            "circle-stroke-width": 1.5,
            "circle-stroke-color": "#ffffff",
          },
        });

        map.on("mouseenter", "facilities-circle", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "facilities-circle", () => {
          map.getCanvas().style.cursor = "";
        });
        map.on("click", "facilities-circle", (e: MapLayerMouseEvent) => {
          const feature = e.features?.[0];
          if (!feature || feature.geometry.type !== "Point") return;
          const coords = feature.geometry.coordinates.slice() as [number, number];
          const props = feature.properties as unknown as FacilityProperties;

          popupRef.current?.remove();
          popupRef.current = new Popup({ closeButton: true, maxWidth: "300px" })
            .setLngLat(coords)
            .setHTML(buildFacilityPopupHtml(props))
            .addTo(map);
        });

        setStatus("ready");
      } catch (err) {
        console.error("Failed to load map layers", err);
        if (!cancelled) setStatus("error");
      }
    });

    return () => {
      cancelled = true;
      popupRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />

      <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-col gap-3">
        <OverlayControl overlay={overlay} onChange={setOverlay} />
      </div>

      {status === "loading" && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-white/60 dark:bg-zinc-950/60">
          <div className="rounded-md bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow dark:bg-zinc-900 dark:text-zinc-200">
            Loading map data…
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-white/60 dark:bg-zinc-950/60">
          <div className="rounded-md bg-white px-4 py-2 text-sm font-medium text-red-700 shadow dark:bg-zinc-900 dark:text-red-400">
            Couldn&apos;t load map data. Check the console and try reloading.
          </div>
        </div>
      )}
    </div>
  );
}
