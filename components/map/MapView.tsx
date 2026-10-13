"use client";

import { useEffect, useRef, useState } from "react";
import {
  GeoJSONSource,
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
  clusterCircleColorExpression,
  clusterCircleRadiusExpression,
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
  const body = await res.json();
  if (!res.ok) throw new Error(body.code ?? "MAP_LAYER_UNAVAILABLE");
  if (body?.type !== "FeatureCollection" || !Array.isArray(body.features)) {
    throw new Error("MAP_LAYER_UNAVAILABLE");
  }
  return body;
}

const DATA_LAYERS = [
  { path: "facilities", label: "Facilities" },
  { path: "water-stress", label: "Water stress" },
  { path: "drought", label: "Current drought" },
  { path: "egrid", label: "Grid carbon intensity" },
  { path: "electricity-price", label: "Electricity price change" },
] as const;

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
  const [notice, setNotice] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState<string[]>([]);

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
        const results = await Promise.allSettled(
          DATA_LAYERS.map(({ path }) => fetchGeoJson(`/api/map/${path}`)),
        );
        if (cancelled) return;
        const failed = DATA_LAYERS.filter((_, index) => results[index].status === "rejected");
        const notConfigured = results.some(
          (result) => result.status === "rejected" &&
            result.reason instanceof Error && result.reason.message === "MAP_NOT_CONFIGURED",
        );
        setUnavailable(failed.map(({ path }) => path));
        setNotice(notConfigured
          ? "Map data is not connected. Showing the base map only."
          : failed.length === DATA_LAYERS.length
            ? "Map data is temporarily unavailable. Showing the base map only. Try reloading."
            : failed.length
              ? `Unavailable layers: ${failed.map(({ label }) => label).join(", ")}. Other layers are available.`
              : null);
        // An unavailable layer stays empty and is explicitly labeled in the UI.
        // It must never prevent independently available layers from rendering.
        const [facilities, waterStress, drought, egrid, electricityPrice] = results.map(
          (result): GeoJSON.FeatureCollection => result.status === "fulfilled"
            ? result.value
            : { type: "FeatureCollection", features: [] },
        );

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
        // Thousands of facilities nationally (vs. the original 5-pin AZ demo)
        // makes clustering a necessity, not polish -- an unclustered national
        // view is an unreadable smear at low zoom. MapLibre's built-in
        // supercluster-based clustering handles this without a custom layer:
        // clustered points aggregate into "clusters" circles sized/colored by
        // count; individual facilities render (and stay clickable for the
        // popup) once zoomed in past clusterMaxZoom or once a cluster is thin
        // enough to break apart.
        map.addSource("facilities", {
          type: "geojson",
          data: facilities,
          cluster: true,
          clusterMaxZoom: 9,
          clusterRadius: 50,
        });

        map.addLayer({
          id: "facilities-clusters",
          type: "circle",
          source: "facilities",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": clusterCircleColorExpression,
            "circle-radius": clusterCircleRadiusExpression,
            "circle-stroke-width": 1.5,
            "circle-stroke-color": "#ffffff",
          },
        });
        map.addLayer({
          id: "facilities-cluster-count",
          type: "symbol",
          source: "facilities",
          filter: ["has", "point_count"],
          layout: {
            "text-field": ["get", "point_count_abbreviated"],
            "text-size": 12,
            "text-font": ["Noto Sans Regular"],
          },
          paint: { "text-color": "#ffffff" },
        });
        map.addLayer({
          id: "facilities-circle",
          type: "circle",
          source: "facilities",
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 3, 8, 7, 12, 11],
            "circle-color": facilityCircleColorExpression,
            "circle-stroke-width": 1.5,
            "circle-stroke-color": "#ffffff",
          },
        });

        map.on("mouseenter", "facilities-clusters", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "facilities-clusters", () => {
          map.getCanvas().style.cursor = "";
        });
        map.on("mouseenter", "facilities-circle", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "facilities-circle", () => {
          map.getCanvas().style.cursor = "";
        });

        map.on("click", "facilities-clusters", async (e: MapLayerMouseEvent) => {
          const feature = e.features?.[0];
          const clusterId = feature?.properties?.cluster_id;
          if (clusterId == null) return;
          const source = map.getSource("facilities");
          if (!(source instanceof GeoJSONSource)) return;
          const zoom = await source.getClusterExpansionZoom(clusterId);
          const coords = (feature!.geometry as GeoJSON.Point).coordinates as [number, number];
          map.easeTo({ center: coords, zoom });
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
      } catch {
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
        <OverlayControl overlay={overlay} onChange={setOverlay} unavailable={unavailable} />
      </div>

      {status === "loading" && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-white/60 dark:bg-zinc-950/60">
          <div className="rounded-md bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow dark:bg-zinc-900 dark:text-zinc-200">
            Loading map data…
          </div>
        </div>
      )}

      {(notice || status === "error") && (
        <div role="status" className="pointer-events-none absolute bottom-10 left-3 right-3 z-20 mx-auto max-w-lg rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow dark:border-amber-800 dark:bg-zinc-900 dark:text-amber-200">
          {status === "error" ? "Could not display map layers. Try reloading the page." : notice}
        </div>
      )}
    </div>
  );
}
