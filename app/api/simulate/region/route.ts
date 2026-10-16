import { NextResponse, type NextRequest } from "next/server";
import { supabaseAnon } from "@/lib/supabase/anon";

// Point -> region context for the simulator mini-map (see
// supabase/migrations/20261016180000_simulator_region_context.sql). The client
// rounds coordinates to 3 decimals (~100 m) before calling, so repeat clicks on
// the same spot share a CDN cache entry. Cached for a day: the slowest-moving
// input it carries is the weekly drought reading.
const CACHE_CONTROL = "public, s-maxage=86400, stale-while-revalidate=3600";

function parseCoord(value: string | null, limit: number) {
  if (value === null || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
}

export async function GET(request: NextRequest) {
  const lat = parseCoord(request.nextUrl.searchParams.get("lat"), 90);
  const lon = parseCoord(request.nextUrl.searchParams.get("lon"), 180);
  if (lat === null || lon === null) {
    return NextResponse.json({ error: "lat and lon are required numbers" }, { status: 400 });
  }

  const { data, error } = await supabaseAnon.rpc("simulator_region_context", {
    p_lon: lon,
    p_lat: lat,
  });
  if (error) {
    console.error("simulator_region_context failed", error);
    return NextResponse.json({ error: "region lookup failed" }, { status: 502 });
  }

  return NextResponse.json(data, { headers: { "Cache-Control": CACHE_CONTROL } });
}
