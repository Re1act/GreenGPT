"use client";

import { useEffect, useRef, useState } from "react";
import {
  GeoJSONSource,
  MapLibreMap,
  NavigationControl,
  Popup,
  type MapLayerMouseEvent,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { BASEMAP_STYLE } from "@/lib/map/maplibreSetup";
import {
  facilityCircleColorExpression,
  clusterCircleColorExpression,
  clusterCircleRadiusExpression,
} from "@/lib/map/colors";
import { buildFacilityPopupHtml, type FacilityProperties } from "@/lib/map/facilityPopup";
import ZipSearch from "@/components/map/ZipSearch";
import FacilityKey from "@/components/map/FacilityKey";


async function fetchGeoJson(path: string): Promise<GeoJSON.FeatureCollection> {
  const res = await fetch(path);
  const body = await res.json();
  if (!res.ok) throw new Error(body.code ?? "MAP_LAYER_UNAVAILABLE");
  if (body?.type !== "FeatureCollection" || !Array.isArray(body.features)) {
    throw new Error("MAP_LAYER_UNAVAILABLE");
  }
  return body;
}


export default function MapView() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [notice, setNotice] = useState<string | null>(null);

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
        let facilities: GeoJSON.FeatureCollection;
        try {
          facilities = await fetchGeoJson("/api/map/facilities");
        } catch (error) {
          if (cancelled) return;
          setNotice(error instanceof Error && error.message === "MAP_NOT_CONFIGURED"
            ? "Map data is not connected. Showing the base map only."
            : "Facility data is temporarily unavailable. Showing the base map only. Try reloading.");
          facilities = { type: "FeatureCollection", features: [] };
        }
        if (cancelled) return;

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
            .setHTML(buildFacilityPopupHtml(props, coords))
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
      <FacilityKey />

      <div className="absolute right-14 top-3 z-30 max-w-[calc(100%-4.25rem)]">
        <ZipSearch onLocate={(center) => {
          popupRef.current?.remove();
          mapRef.current?.flyTo({ center, zoom: 11, duration: 1400 });
        }} />
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
