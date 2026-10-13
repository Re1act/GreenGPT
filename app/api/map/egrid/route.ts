import { layerResponse, LAYER_CACHE_CONTROL } from "@/lib/map/layers";

export async function GET() {
  return layerResponse("egrid_geojson", LAYER_CACHE_CONTROL.egrid);
}
