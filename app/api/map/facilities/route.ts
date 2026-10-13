import { layerResponse, LAYER_CACHE_CONTROL } from "@/lib/map/layers";

export async function GET() {
  return layerResponse("facilities_geojson", LAYER_CACHE_CONTROL.facilities);
}
