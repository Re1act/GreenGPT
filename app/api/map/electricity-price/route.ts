import { NextResponse } from "next/server";
import { fetchLayer, LAYER_CACHE_CONTROL } from "@/lib/map/layers";

export async function GET() {
  const geojson = await fetchLayer("electricity_price_geojson");
  return NextResponse.json(geojson, {
    headers: { "Cache-Control": LAYER_CACHE_CONTROL.electricityPrice },
  });
}
