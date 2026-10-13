// Seeds public.electricity_prices from EIA's API v2 (Form 861-derived retail sales
// data), residential sector, state-level annual average price.
// Docs: https://www.eia.gov/opendata/documentation.php
//
// Requires a free EIA API key (self-serve registration at
// https://www.eia.gov/opendata/register/) in EIA_API_KEY. This script does not
// register one for you -- that requires an email address, and registering third
// party accounts on a user's behalf isn't something to do without being asked.
// Run: node --env-file=.env.local scripts/ingest/electricity-prices.mjs
import { supabase, withRunLog } from "./_client.mjs";
import { STATE_FIPS_TO_ABBR } from "./_stateFips.mjs";

// Valid FK targets in public.states (50 states + DC + PR, per states.mjs). EIA's
// API also returns Census-division aggregate rows (ENC, MAT, MTN, ...) mixed in
// with real states -- those aren't states and must be filtered out, not treated
// as ingestion failures.
const NAME_TO_ABBR_SET = new Set(Object.values(STATE_FIPS_TO_ABBR));

const API_KEY = process.env.EIA_API_KEY;
const START_YEAR = 2019; // covers the brief's "indexed to 2020" base plus a pre-2020 sanity point
const END_YEAR = new Date().getFullYear();

async function run() {
  if (!API_KEY) {
    throw new Error(
      "EIA_API_KEY is not set. Register a free key at https://www.eia.gov/opendata/register/ and add it to .env.local."
    );
  }

  const url = new URL("https://api.eia.gov/v2/electricity/retail-sales/data/");
  url.search = new URLSearchParams({
    api_key: API_KEY,
    frequency: "annual",
    "data[0]": "price",
    "facets[sectorid][0]": "RES",
    start: String(START_YEAR),
    end: String(END_YEAR),
    "sort[0][column]": "period",
    "sort[0][direction]": "asc",
    length: "5000",
  }).toString();

  const res = await fetch(url);
  if (!res.ok) throw new Error(`EIA fetch failed: ${res.status} ${res.statusText}`);
  const body = await res.json();
  const rows = body.response?.data ?? [];

  let rowsUpserted = 0;
  let rowsFailed = 0;
  const failures = [];

  for (const row of rows) {
    const state = row.stateid;
    const year = Number(row.period);
    const price = Number(row.price);
    if (!state || !Number.isFinite(price) || !NAME_TO_ABBR_SET.has(state)) continue; // skip US total and Census-division aggregates (ENC, MAT, etc.)

    const { error } = await supabase.rpc("upsert_electricity_price", {
      p_state: state,
      p_year: year,
      p_price: price,
    });
    if (error) {
      rowsFailed++;
      failures.push(`${state} ${year}: ${error.message}`);
    } else {
      rowsUpserted++;
    }
  }

  return {
    rowsUpserted,
    rowsFailed,
    notes: failures.length ? failures.slice(0, 20).join("; ") : null,
  };
}

await withRunLog("electricity_prices", run);
