"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AttributionControl, MapLibreMap, NavigationControl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { BASEMAP_STYLE } from "@/lib/map/maplibreSetup";

export default function HomeMapPreview() {
  const container = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [message, setMessage] = useState("Loading data centers…");

  useEffect(() => {
    if (!container.current) return;
    const controller = new AbortController();
    const map = new MapLibreMap({
      container: container.current,
      style: BASEMAP_STYLE,
      bounds: [[-125, 24], [-66, 50]],
      fitBoundsOptions: { padding: 24 },
      minZoom: 1.5,
      maxZoom: 11,
      cooperativeGestures: true,
      doubleClickZoom: false,
      dragRotate: false,
      pitchWithRotate: false,
      attributionControl: false,
      canvasContextAttributes: { antialias: true },
    });
    map.addControl(new NavigationControl({ showCompass: false }), "bottom-left");
    map.addControl(new AttributionControl({ compact: true }), "bottom-right");
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(container.current);
    let disposed = false;
    const timeout = window.setTimeout(() => {
      if (!disposed) setMessage("Preview taking a while? Open the full map ↗");
    }, 20000);
    map.on("load", async () => {
      try {
        const res = await fetch("/api/map/facilities", { signal: controller.signal });
        if (!res.ok) throw new Error("Unavailable");
        const data = await res.json();
        if (data.type !== "FeatureCollection" || !Array.isArray(data.features)) throw new Error("Invalid data");
        if (disposed) return;
        map.addSource("preview-facilities", { type: "geojson", data });
        map.addLayer({
          id: "preview-facilities", type: "circle", source: "preview-facilities",
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 2, 6, 3.5, 11, 6],
            "circle-color": "#236973", "circle-opacity": 0.8,
            "circle-stroke-color": "#f8f9f3", "circle-stroke-width": 0.5,
          },
        });
        setMessage("");
      } catch {
        if (!disposed) setMessage("Facility preview unavailable · Open full map ↗");
      } finally { window.clearTimeout(timeout); }
    });
    map.on("click", event => {
      const feature = map.getLayer("preview-facilities")
        ? map.queryRenderedFeatures(event.point, { layers: ["preview-facilities"] })[0] : undefined;
      router.push(feature?.properties?.id ? `/map?facility=${encodeURIComponent(String(feature.properties.id))}` : "/map");
    });
    map.on("mouseenter", "preview-facilities", () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", "preview-facilities", () => { map.getCanvas().style.cursor = ""; });
    return () => { disposed = true; controller.abort(); window.clearTimeout(timeout); observer.disconnect(); map.remove(); };
  }, [router]);

  return <div className="relative min-w-0 overflow-hidden rounded-2xl border border-[#9abbb9] bg-[#e0eff0] shadow-lg shadow-[#174b50]/10">
    <div ref={container} role="region" aria-label="Interactive preview of U.S. data centers. Drag to pan; select a location to open the full map." className="h-[300px] w-full sm:h-[340px] lg:h-[360px]" />
    <span className="pointer-events-none absolute left-3 top-3 rounded-lg bg-[#fffefa]/95 px-3 py-2 text-xs font-semibold text-[#174b50] shadow-sm">U.S. data centers</span>
    <Link href="/map" aria-label="Open full data center map" title="Open full map" className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-lg border border-[#b3ccca] bg-[#fffefa] text-[#174b50] shadow-sm transition hover:bg-[#dceee9]">
      <svg aria-hidden="true" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7M7 7h10v10" /></svg>
    </Link>
    {message && <Link href="/map" role="status" className="absolute bottom-9 left-14 right-3 rounded-lg bg-[#fffefa]/95 px-3 py-2 text-xs text-[#174b50] shadow-sm">{message}</Link>}
  </div>;
}
