"use client";

import { useEffect, useRef } from "react";
import { MapLibreMap, Marker, NavigationControl, type MapMouseEvent } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { BASEMAP_STYLE } from "@/lib/map/maplibreSetup";
import type { LatLon } from "@/lib/simulator/params";

// Click-to-site map for the walkthrough's first step. Deliberately just a
// basemap and a pin: the region's grid, basin, and drought context come back
// from the lookup and render as text beside it, so this map never needs the
// national map's 7MB+ of overlays.
export default function RegionPicker({
  point,
  onPick,
  className = "h-full w-full",
}: {
  point: LatLon | null;
  onPick: (p: LatLon) => void;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  // Keep the latest callback without re-creating the map when it changes.
  const onPickRef = useRef(onPick);
  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  // The initial point only seeds the starting view; later picks move the
  // marker (below) without re-centering, so the map doesn't jump on click.
  const initialPointRef = useRef(point);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const start = initialPointRef.current;
    const map = new MapLibreMap({
      container: containerRef.current,
      style: BASEMAP_STYLE,
      center: start ? [start.lon, start.lat] : [-96, 38.5],
      zoom: start ? 6 : 3.6,
      minZoom: 2,
      maxZoom: 11,
    });
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(containerRef.current);
    mapRef.current = map;
    map.addControl(new NavigationControl({ showCompass: false }), "bottom-right");
    map.getCanvas().style.cursor = "crosshair";
    map.on("click", (e: MapMouseEvent) => {
      onPickRef.current({ lat: e.lngLat.lat, lon: e.lngLat.lng });
    });

    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!point) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    if (!markerRef.current) {
      markerRef.current = new Marker({ color: "#2a78d6" });
    }
    markerRef.current.setLngLat([point.lon, point.lat]).addTo(map);
  }, [point]);

  return (
    <div
      ref={containerRef}
      className={className}
      role="application"
      aria-label="Map: click to choose where to site the hypothetical facility"
    />
  );
}
