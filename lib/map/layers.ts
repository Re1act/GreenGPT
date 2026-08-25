import "server-only";
import { supabaseAnon } from "@/lib/supabase/anon";

// Every map layer is served the same way: call the layer's *_geojson() RPC
// (defined in supabase/migrations/20260825181942_map_geojson_rpcs.sql, which
// already returns a ready-to-use GeoJSON FeatureCollection as jsonb).
//
// Caching note: this used to wrap each call in `unstable_cache` (Next's Data
// Cache). That broke in testing -- the Data Cache has a hard 2MB-per-item limit,
// and eGRID (2.28MB) and water stress (4.9MB) both exceed it, which surfaced as
// either a 500 ("items over 2MB can not be cached") or a silently empty result
// depending on the layer. These are large, non-personalized, infrequently-
// changing blobs -- exactly what HTTP/CDN caching is for, and Cache-Control has
// no such size ceiling. So caching now happens via the `Cache-Control` header
// set on the route handler's response (Vercel's Edge Network honors s-maxage;
// in local dev there's no CDN in front, so every request hits Supabase directly,
// which is expected).
type LayerRpcName =
  | "facilities_geojson"
  | "water_stress_geojson"
  | "egrid_geojson"
  | "drought_geojson"
  | "electricity_price_geojson";

export async function fetchLayer(rpc: LayerRpcName) {
  const { data, error } = await supabaseAnon.rpc(rpc);
  if (error) {
    throw new Error(`${rpc} failed: ${error.message}`);
  }
  return data;
}

// s-maxage windows matched to each layer's real refresh cadence (see the map
// brainstorm: facilities are curated continuously, drought refreshes weekly from
// NIDIS, water stress/eGRID/electricity price are annual or slower).
// stale-while-revalidate lets the CDN keep serving the old response instantly
// while it fetches a fresh one in the background, instead of one unlucky
// visitor paying for a slow cache miss.
export const LAYER_CACHE_CONTROL = {
  facilities: "public, s-maxage=300, stale-while-revalidate=3600",
  waterStress: "public, s-maxage=604800, stale-while-revalidate=86400",
  egrid: "public, s-maxage=604800, stale-while-revalidate=86400",
  drought: "public, s-maxage=86400, stale-while-revalidate=3600",
  electricityPrice: "public, s-maxage=604800, stale-while-revalidate=86400",
} as const;
