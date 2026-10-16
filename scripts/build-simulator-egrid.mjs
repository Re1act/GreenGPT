// Generates lib/simulator/data/egrid2023-subregions.json -- the per-subregion
// emission rate and generation resource mix the simulator runs against.
//
// Why a generated JSON file and not the egrid_subregions table: the brief requires
// the simulator to be pure client-side computation against a versioned
// coefficients file ("no backend call, instant feedback on every slider drag").
// The only server round trip the simulator makes is the one-time point -> region
// lookup when the user clicks the mini-map; everything numeric lives here.
//
// Reads the same eGRID2023 workbook scripts/ingest/egrid.mjs downloads into
// .tmp-ingest/ (run that once first, or drop the file there by hand). Touches no
// database -- this is a local file -> local file transform. Columns are looked up
// by eGRID's own field codes (row 2 of each sheet), not by position, so a column
// reorder in a future eGRID release fails loudly instead of silently shifting.
// Run: node scripts/build-simulator-egrid.mjs
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import XLSX from "xlsx";

const XLSX_PATH = ".tmp-ingest/egrid2023.xlsx";
const OUT_DIR = "lib/simulator/data";
const OUT_PATH = `${OUT_DIR}/egrid2023-subregions.json`;
const SOURCE_URL = "https://www.epa.gov/system/files/documents/2025-06/egrid2023_data_rev2.xlsx";

// eGRID field-code suffixes for the resource mix (generation percent), shared by
// the subregion (SR*) and national (US*) sheets.
const MIX_FIELDS = {
  coal: "CLPR",
  oil: "OLPR",
  gas: "GSPR",
  nuclear: "NCPR",
  hydro: "HYPR",
  biomass: "BMPR",
  wind: "WIPR",
  solar: "SOPR",
  geothermal: "GTPR",
  otherFossil: "OFPR",
  unknown: "OPPR",
};

function readSheet(wb, sheetName) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });
  const codes = rows[1];
  const col = (code) => {
    const i = codes.indexOf(code);
    if (i === -1) throw new Error(`${sheetName}: field ${code} not found`);
    return i;
  };
  return { rows: rows.slice(2), col };
}

function mixFrom(row, col, prefix) {
  const mix = {};
  for (const [fuel, suffix] of Object.entries(MIX_FIELDS)) {
    const v = row[col(prefix + suffix)];
    mix[fuel] = typeof v === "number" ? v : 0;
  }
  return mix;
}

if (!existsSync(XLSX_PATH)) {
  throw new Error(`${XLSX_PATH} not found -- see scripts/ingest/egrid.mjs, which downloads it.`);
}

const wb = XLSX.readFile(XLSX_PATH);

const sr = readSheet(wb, "SRL23");
const subregions = {};
for (const row of sr.rows) {
  const code = row[sr.col("SUBRGN")];
  if (!code) continue;
  subregions[code] = {
    name: row[sr.col("SRNAME")],
    co2eLbPerMWh: row[sr.col("SRC2ERTA")],
    mix: mixFrom(row, sr.col, "SR"),
  };
}

const us = readSheet(wb, "US23");
const usRow = us.rows[0];
const usAverage = {
  name: "U.S. average",
  co2eLbPerMWh: usRow[us.col("USC2ERTA")],
  mix: mixFrom(usRow, us.col, "US"),
};

const out = {
  source: {
    name: "EPA eGRID2023 (rev 2), sheets SRL23 and US23",
    url: SOURCE_URL,
    date: "2025-06",
    dataYear: 2023,
    fields:
      "co2eLbPerMWh = SRC2ERTA / USC2ERTA (annual CO2-equivalent total output emission rate); mix = *PR resource-mix generation fractions",
  },
  usAverage,
  subregions,
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + "\n");
console.log(`wrote ${Object.keys(subregions).length} subregions + U.S. average to ${OUT_PATH}`);
