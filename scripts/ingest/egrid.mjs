// Seeds public.egrid_subregions from two separate EPA eGRID2023 downloads that
// have to be joined by subregion code:
//   - Boundaries: egrid2023_subregions.zip (shapefile), full-resolution coastline
//     precision -- simplified client-side before upload (@turf/simplify) since the
//     raw geometry runs tens of MB per feature and there's no PostGIS-side
//     simplification happening at write time, only at read time in the map RPCs.
//   - Emission rates: egrid2023_data_rev2.xlsx, sheet SRL23 (subregion-level),
//     column SRC2ERTA = annual CO2-equivalent *output* emission rate (lb/MWh) --
//     matches the simulator's `emissions_t = annual_MWh * eGRID_subregion_intensity`
//     coefficient and is the standard Scope 2 factor, not raw CO2 (which would
//     undercount CH4/N2O).
//
// Downloads both source files to .tmp-ingest/ on first run (gitignored, ~80MB
// combined) and reuses them on subsequent runs -- self-contained so this can
// become the actual recurring annual job the brief's ingestion architecture
// calls for, not a script that only works after manual setup.
// Run: node --env-file=.env.local scripts/ingest/egrid.mjs
import { existsSync, mkdirSync, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import AdmZip from "adm-zip";
import shapefile from "shapefile";
import XLSX from "xlsx";
import simplify from "@turf/simplify";
import { supabase, withRunLog } from "./_client.mjs";

const XLSX_URL = "https://www.epa.gov/system/files/documents/2025-06/egrid2023_data_rev2.xlsx";
const SHP_ZIP_URL = "https://www.epa.gov/system/files/other-files/2025-01/egrid2023_subregions.zip";

const TMP_DIR = ".tmp-ingest";
const XLSX_PATH = `${TMP_DIR}/egrid2023.xlsx`;
const SHP_ZIP_PATH = `${TMP_DIR}/egrid_subregions.zip`;
const SHP_DIR = `${TMP_DIR}/egrid_shp`;
const SHP_PATH = `${SHP_DIR}/eGRID2023_Subregions.shp`;
const DBF_PATH = `${SHP_DIR}/eGRID2023_Subregions.dbf`;

const DATA_YEAR = 2023;
const SIMPLIFY_TOLERANCE = 0.01; // degrees -- geometry is stored simplified (write-time, not read-time)

async function downloadTo(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${url} -> ${res.status} ${res.statusText}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(destPath));
}

async function ensureSourceFiles() {
  mkdirSync(TMP_DIR, { recursive: true });

  if (!existsSync(XLSX_PATH)) {
    console.log("[egrid] downloading eGRID2023 data workbook (~21MB)...");
    await downloadTo(XLSX_URL, XLSX_PATH);
  }

  if (!existsSync(SHP_PATH)) {
    if (!existsSync(SHP_ZIP_PATH)) {
      console.log("[egrid] downloading eGRID2023 subregion shapefile (~57MB)...");
      await downloadTo(SHP_ZIP_URL, SHP_ZIP_PATH);
    }
    mkdirSync(SHP_DIR, { recursive: true });
    new AdmZip(SHP_ZIP_PATH).extractAllTo(SHP_DIR, true);
  }
}

function loadEmissionRates() {
  const wb = XLSX.readFile(XLSX_PATH);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets["SRL23"], { header: 1, range: 2 });
  const rates = new Map();
  for (const row of rows) {
    const code = row[1]; // SUBRGN
    const name = row[2]; // SRNAME
    const co2eRate = row[25]; // SRC2ERTA
    if (!code) continue;
    rates.set(code, { name, co2eRate: typeof co2eRate === "number" ? co2eRate : null });
  }
  return rates;
}

async function run() {
  await ensureSourceFiles();
  const rates = loadEmissionRates();
  const source = await shapefile.open(SHP_PATH, DBF_PATH);

  let rowsUpserted = 0;
  let rowsFailed = 0;
  const failures = [];

  let result;
  while (!(result = await source.read()).done) {
    const code = result.value.properties.Subregion;
    const rate = rates.get(code);
    if (!rate) {
      rowsFailed++;
      failures.push(`${code}: no emission rate row in SRL23`);
      continue;
    }

    const simplified = simplify.default
      ? simplify.default({ type: "Feature", properties: {}, geometry: result.value.geometry }, {
          tolerance: SIMPLIFY_TOLERANCE,
          highQuality: false,
        })
      : simplify({ type: "Feature", properties: {}, geometry: result.value.geometry }, {
          tolerance: SIMPLIFY_TOLERANCE,
          highQuality: false,
        });

    const { error } = await supabase.rpc("upsert_egrid_subregion", {
      p_code: code,
      p_name: rate.name ?? code,
      p_geojson: simplified.geometry,
      p_co2_lbs_per_mwh: rate.co2eRate,
      p_year: DATA_YEAR,
    });
    if (error) {
      rowsFailed++;
      failures.push(`${code}: ${error.message}`);
    } else {
      rowsUpserted++;
    }
  }

  return {
    rowsUpserted,
    rowsFailed,
    notes: failures.length ? failures.join("; ") : null,
  };
}

await withRunLog("egrid", run);
