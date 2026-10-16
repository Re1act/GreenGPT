import type { LatLon } from "@/lib/simulator/params";

// Client-side contract for /api/simulate/region (the simulator_region_context
// RPC). One lookup per map click; every field is independently nullable.
export type RegionContext = {
  egrid: { subregion_code: string; name: string }[];
  water_stress: {
    basin_name: string;
    baseline_stress_score: number | null;
    baseline_stress_category: string;
    source_version: string | null;
  } | null;
  county: { fips: string; name: string; state: string } | null;
  drought: { drought_level: string; as_of_date: string } | null;
  state: string | null;
};

export type RegionLookup = {
  status: "idle" | "loading" | "ready" | "error";
  context: RegionContext | null;
};

export async function fetchRegion(p: LatLon): Promise<RegionContext> {
  const res = await fetch(`/api/simulate/region?lat=${p.lat}&lon=${p.lon}`);
  if (!res.ok) throw new Error(`region lookup failed: ${res.status}`);
  return res.json();
}

// ~100 m: plenty for picking a grid region, and lets repeat clicks share a
// CDN cache entry (see the route handler).
export function roundPoint(p: LatLon): LatLon {
  return { lat: Math.round(p.lat * 1000) / 1000, lon: Math.round(p.lon * 1000) / 1000 };
}

/** "Pima County, AZ", or a coordinate fallback when no county resolved. */
export function placeName(ctx: RegionContext | null, point: LatLon | null): string {
  if (ctx?.county) return `${ctx.county.name}, ${ctx.county.state}`;
  if (ctx?.state) return ctx.state;
  if (point) return `${point.lat.toFixed(2)}, ${point.lon.toFixed(2)}`;
  return "the U.S. (no site picked)";
}
