// Seeds public.zip_centroids from the Census Bureau's 2023 Gazetteer ZCTA file:
// one representative ("internal") point per ZIP Code Tabulation Area. Each ZIP's
// county is the one holding most of its land, per Census's ZCTA-to-county
// relationship file; the database falls back to matching the point against
// county polygons when that county isn't in our table (Connecticut's planning
// regions). See upsert_zip_centroids in
// supabase/migrations/20261024120000_zip_county_hint.sql.
//
// ZCTAs approximate USPS ZIP codes but aren't identical: PO-box-only and
// single-building ZIPs have no ZCTA. The brief falls back to a geocoder for
// those (lib/brief/data.ts), so a missing row here is a degraded path, not an
// error.
// Requires counties to be seeded first (scripts/ingest/counties.mjs).
// Sources: https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2023_Gazetteer/2023_Gaz_zcta_national.zip
//          https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_county20_natl.txt
// Run: node --env-file=.env.local scripts/ingest/zip-centroids.mjs
import { existsSync, mkdirSync, createWriteStream, readFileSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import AdmZip from "adm-zip";
import { supabase, withRunLog } from "./_client.mjs";
import { mapWithConcurrency } from "./_stateFips.mjs";
import { parseGazetteer, parseZctaCounty } from "./_gazetteer.mjs";

const ZIP_URL =
  "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2023_Gazetteer/2023_Gaz_zcta_national.zip";
const TMP_DIR = ".tmp-ingest";
const ZIP_PATH = `${TMP_DIR}/gazetteer_zcta.zip`;
const TXT_DIR = `${TMP_DIR}/gazetteer_zcta`;
const TXT_PATH = `${TXT_DIR}/2023_Gaz_zcta_national.txt`;
const REL_URL =
  "https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_county20_natl.txt";
const REL_PATH = `${TMP_DIR}/tab20_zcta520_county20_natl.txt`;

// Each batch does a spatial join per row inside one statement; 500 keeps a
// batch comfortably under the statement timeout.
const BATCH_SIZE = 500;

async function ensureSourceFile() {
  mkdirSync(TMP_DIR, { recursive: true });
  if (existsSync(TXT_PATH)) return;
  if (!existsSync(ZIP_PATH)) {
    console.log("[zip-centroids] downloading Census Gazetteer ZCTA file (~1MB)...");
    const res = await fetch(ZIP_URL);
    if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);
    await pipeline(Readable.fromWeb(res.body), createWriteStream(ZIP_PATH));
  }
  mkdirSync(TXT_DIR, { recursive: true });
  new AdmZip(ZIP_PATH).extractAllTo(TXT_DIR, true);
}

async function ensureRelationshipFile() {
  if (existsSync(REL_PATH)) return;
  console.log("[zip-centroids] downloading Census ZCTA-to-county relationship file (~7MB)...");
  const res = await fetch(REL_URL);
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(REL_PATH));
}

async function run() {
  await ensureSourceFile();
  await ensureRelationshipFile();
  const counties = parseZctaCounty(readFileSync(REL_PATH, "utf8"));
  const rows = parseGazetteer(readFileSync(TXT_PATH, "utf8")).map((r) => ({
    ...r,
    county_fips: counties.get(r.zip) ?? null,
  }));
  console.log(`[zip-centroids] parsed ${rows.length} ZCTAs (${counties.size} with a Census county)`);

  const batches = [];
  for (let i = 0; i < rows.length; i += BATCH_SIZE) batches.push(rows.slice(i, i + BATCH_SIZE));

  let rowsUpserted = 0;
  let rowsFailed = 0;
  const failures = [];

  await mapWithConcurrency(batches, 4, async (batch, i) => {
    const { data, error } = await supabase.rpc("upsert_zip_centroids", { p_rows: batch });
    if (error) {
      rowsFailed += batch.length;
      failures.push(`batch ${i} (${batch[0].zip}…): ${error.message}`);
      return;
    }
    rowsUpserted += data.upserted;
    rowsFailed += data.skipped;
    if (data.skipped) failures.push(`batch ${i}: ${data.skipped} ZIPs had no county (U.S. territories outside PR)`);
  });

  return {
    rowsUpserted,
    rowsFailed,
    notes: failures.length ? failures.slice(0, 20).join("; ") : null,
  };
}

await withRunLog("zip_centroids", run);
