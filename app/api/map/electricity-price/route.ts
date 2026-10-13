import { layerResponse, LAYER_CACHE_CONTROL } from "@/lib/map/layers";

export async function GET() {
  return layerResponse("electricity_price_geojson", LAYER_CACHE_CONTROL.electricityPrice);
}
