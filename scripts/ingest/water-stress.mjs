// Seeds public.water_stress_basins from WRI's Aqueduct 2.1 global basin layer,
// hosted as a public ArcGIS FeatureServer (AmeriGEOSS mirror of WRI's data).
// Source: https://services2.arcgis.com/xsh7pVZv42relbEf/arcgis/rest/services/aqueductglobalmaps21shp
// (confirmed as the actual global dataset -- an earlier candidate FeatureServer
// turned out to only cover South America and was discarded during sourcing.)
//
// Basin polygons don't respect political borders, so the bbox query alone pulls
// in Canada/Mexico basin slivers along the border too. Originally kept those (a
// more geographically honest picture), but at national-map scale they turned out
// to be mostly payload with no value -- filtering to COUNTRY = "United States of
// America" (confirmed via the actual stored data, not guessed) cut row count
// from 2,203 to ~635 and was necessary to get water_stress_geojson() under the
// anon role's statement timeout (it was timing out at ~4.4s serializing all
// 2,203 rows -- see the write-time-simplification migrations for the other half
// of that fix).
// Run: node --env-file=.env.local scripts/ingest/water-stress.mjs
import { supabase, withRunLog } from "./_client.mjs";

const US_COUNTRY_NAME = "United States of America";
import { mapWithConcurrency } from "./_stateFips.mjs";

const SERVICE_URL =
  "https://services2.arcgis.com/xsh7pVZv42relbEf/arcgis/rest/services/aqueductglobalmaps21shp/FeatureServer/0/query";
const PAGE_SIZE = 1000;
const SOURCE_VERSION = "Aqueduct 2.1 global maps (AmeriGEOSS ArcGIS mirror)";

// Continental US, Alaska, Hawaii, Puerto Rico -- covers every state a facility
// could realistically be sited in for this project's scope.
const REGIONS = [
  { name: "conus", bbox: "-125,24,-66,49" },
  { name: "alaska", bbox: "-180,51,-129,72" },
  { name: "hawaii", bbox: "-161,18,-154,23" },
  { name: "puerto-rico", bbox: "-68,17,-65,19" },
];

async function fetchRegion(bbox) {
  const features = [];
  let offset = 0;
  for (;;) {
    const url = new URL(SERVICE_URL);
    url.search = new URLSearchParams({
      geometry: bbox,
      geometryType: "esriGeometryEnvelope",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields: "FID,BasinID,BASIN_NAME,COUNTRY,BWS,BWS_s,BWS_cat",
      f: "geojson",
      resultRecordCount: String(PAGE_SIZE),
      resultOffset: String(offset),
    }).toString();

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
    const geojson = await res.json();
    features.push(...geojson.features);
    if (geojson.features.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return features;
}

async function run() {
  const seen = new Map(); // dedupe by FID across overlapping region boxes
  for (const region of REGIONS) {
    const features = await fetchRegion(region.bbox);
    for (const f of features) {
      seen.set(f.properties.FID, f);
    }
  }

  const usFeatures = Array.from(seen.values()).filter(
    (f) => f.properties.COUNTRY === US_COUNTRY_NAME
  );

  // Full reload each run (this is a small, rarely-changing reference layer):
  // clear out anything from a previous run (e.g. the non-US slivers from before
  // this filter existed) rather than leaving orphaned rows an upsert won't touch.
  const { error: clearError } = await supabase
    .from("water_stress_basins")
    .delete()
    .neq("aqueduct_id", "__never_matches__");
  if (clearError) throw new Error(`Failed to clear water_stress_basins: ${clearError.message}`);

  let rowsUpserted = 0;
  let rowsFailed = 0;
  const failures = [];

  await mapWithConcurrency(usFeatures, 12, async (feature) => {
    const p = feature.properties;
    const basinName = (p.BASIN_NAME || "").trim() || `Basin ${p.BasinID}`;
    const { error } = await supabase.rpc("upsert_water_stress_basin", {
      p_aqueduct_id: `fid-${p.FID}`,
      p_basin_name: `${basinName} (${p.COUNTRY})`,
      p_geojson: feature.geometry,
      p_score: p.BWS_s ?? null,
      p_category: p.BWS_cat ?? "Unknown",
      p_version: SOURCE_VERSION,
    });
    if (error) {
      rowsFailed++;
      failures.push(`fid-${p.FID}: ${error.message}`);
    } else {
      rowsUpserted++;
    }
  });

  return {
    rowsUpserted,
    rowsFailed,
    notes: failures.length ? failures.slice(0, 20).join("; ") : null,
  };
}

await withRunLog("water_stress", run);
