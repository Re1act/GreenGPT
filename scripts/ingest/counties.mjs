// Seeds public.counties from the Census Bureau's own current cartographic
// boundary file (not a third-party mirror). Originally used Plotly's popular
// FIPS-keyed county GeoJSON, but that mirror is old enough to predate several
// real FIPS changes -- Connecticut's 2022 switch from 8 counties to 9 planning
// regions, an Alaska census-area reorg (Chugach/Copper River split off in 2019,
// Wade Hampton renamed Kusilvak in 2015), and South Dakota's Shannon County
// renamed Oglala Lakota County in 2015 -- which caused 13 counties to silently
// fail the drought ingestion's foreign key (their FIPS codes didn't exist in our
// reference table). Census's own file has all of them.
// Source: https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_us_county_20m.zip
// Run: node --env-file=.env.local scripts/ingest/counties.mjs
import { existsSync, mkdirSync, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import AdmZip from "adm-zip";
import shapefile from "shapefile";
import { supabase, withRunLog } from "./_client.mjs";
import { mapWithConcurrency } from "./_stateFips.mjs";

const ZIP_URL = "https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_us_county_20m.zip";
const TMP_DIR = ".tmp-ingest";
const ZIP_PATH = `${TMP_DIR}/census_counties.zip`;
const SHP_DIR = `${TMP_DIR}/census_counties`;
const SHP_PATH = `${SHP_DIR}/cb_2023_us_county_20m.shp`;
const DBF_PATH = `${SHP_DIR}/cb_2023_us_county_20m.dbf`;

async function ensureSourceFiles() {
  mkdirSync(TMP_DIR, { recursive: true });
  if (!existsSync(SHP_PATH)) {
    if (!existsSync(ZIP_PATH)) {
      console.log("[counties] downloading Census county boundary file (~1MB)...");
      const res = await fetch(ZIP_URL);
      if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);
      await pipeline(Readable.fromWeb(res.body), createWriteStream(ZIP_PATH));
    }
    mkdirSync(SHP_DIR, { recursive: true });
    new AdmZip(ZIP_PATH).extractAllTo(SHP_DIR, true);
  }
}

async function run() {
  await ensureSourceFiles();
  const source = await shapefile.open(SHP_PATH, DBF_PATH);

  const features = [];
  let result;
  while (!(result = await source.read()).done) {
    features.push(result.value);
  }

  let rowsUpserted = 0;
  let rowsFailed = 0;
  const failures = [];

  await mapWithConcurrency(features, 12, async (feature) => {
    const { GEOID, NAMELSAD, STUSPS } = feature.properties;
    const { error } = await supabase.rpc("upsert_county", {
      p_fips: GEOID,
      p_name: NAMELSAD,
      p_state: STUSPS,
      p_geojson: feature.geometry,
    });
    if (error) {
      rowsFailed++;
      failures.push(`${GEOID}: ${error.message}`);
    } else {
      rowsUpserted++;
    }
  });

  // Switching sources means some FIPS codes from the old plotly-based seeding
  // (pre-2022 Connecticut counties, pre-reorg Alaska/SD codes) no longer exist
  // in this file -- an upsert alone leaves those behind as stale duplicates
  // covering the same geography as their replacements. Deleting them only
  // *after* the upsert (rather than clearing the table first) means we never
  // attempt to delete a row that drought_conditions' foreign key might still be
  // pointing at -- the stale rows are exactly the ones nothing references,
  // since the drought source already speaks the current FIPS scheme.
  const currentFips = new Set(features.map((f) => f.properties.GEOID));
  const { data: existing } = await supabase.from("counties").select("fips");
  const staleFips = (existing ?? []).map((r) => r.fips).filter((fips) => !currentFips.has(fips));
  let rowsDeleted = 0;
  if (staleFips.length > 0) {
    const { error: deleteError, count } = await supabase
      .from("counties")
      .delete({ count: "exact" })
      .in("fips", staleFips);
    if (deleteError) {
      failures.push(`cleanup of ${staleFips.length} stale rows failed: ${deleteError.message}`);
    } else {
      rowsDeleted = count ?? staleFips.length;
    }
  }

  return {
    rowsUpserted,
    rowsFailed,
    notes: [
      failures.length ? failures.slice(0, 20).join("; ") : null,
      rowsDeleted ? `removed ${rowsDeleted} stale rows from the old source: ${staleFips.join(", ")}` : null,
    ]
      .filter(Boolean)
      .join(" | ") || null,
  };
}

await withRunLog("counties", run);
