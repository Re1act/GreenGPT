// Seeds/refreshes public.drought_conditions from the NIDIS/US Drought Monitor
// web service, documented at:
// https://droughtmonitor.unl.edu/DmData/DataDownload/WebServiceInfo.aspx
//
// Queried with statisticsType=2 ("categorical"/exclusive area breakdown, i.e.
// area-in-D2-only rather than cumulative area-in-D2-or-worse) so the dominant
// category per county is just whichever column has the largest area -- no need
// to reconstruct exclusivity from the cumulative statisticsType=1 form.
//
// This is the job intended to run weekly per the brief's ingestion architecture
// (Vercel Cron / GitHub Actions); this script is that job, run manually for now.
// Run: node --env-file=.env.local scripts/ingest/drought.mjs
import { supabase, withRunLog } from "./_client.mjs";
import { STATE_FIPS_TO_ABBR, mapWithConcurrency } from "./_stateFips.mjs";

const STATE_ABBRS = [...new Set(Object.values(STATE_FIPS_TO_ABBR))].filter(
  (abbr) => !["AS", "GU", "MP", "PR", "VI"].includes(abbr) // USDM doesn't track these
);

const LEVELS = ["none", "d0", "d1", "d2", "d3", "d4"];
const LEVEL_TO_ENUM = { none: "none", d0: "D0", d1: "D1", d2: "D2", d3: "D3", d4: "D4" };

function usDate(d) {
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

function dominantLevel(row) {
  let best = "none";
  let bestArea = -1;
  for (const level of LEVELS) {
    const area = Number(row[level] ?? 0);
    if (area > bestArea) {
      bestArea = area;
      best = level;
    }
  }
  return LEVEL_TO_ENUM[best];
}

async function fetchStateCounties(abbr, startDate, endDate) {
  const url = new URL(
    "https://usdmdataservices.unl.edu/api/CountyStatistics/GetDroughtSeverityStatisticsByArea"
  );
  url.search = new URLSearchParams({
    aoi: abbr,
    startdate: usDate(startDate),
    enddate: usDate(endDate),
    statisticsType: "2",
  }).toString();

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`${abbr}: fetch failed ${res.status} ${res.statusText}`);
  return res.json();
}

async function run() {
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 10); // window wide enough to catch the latest weekly publication

  let rowsUpserted = 0;
  let rowsFailed = 0;
  const failures = [];

  await mapWithConcurrency(STATE_ABBRS, 8, async (abbr) => {
    let rows;
    try {
      rows = await fetchStateCounties(abbr, startDate, endDate);
    } catch (err) {
      rowsFailed++;
      failures.push(String(err.message ?? err));
      return;
    }

    // Keep only the most recent publication per county within the window.
    const latestByFips = new Map();
    for (const row of rows) {
      const existing = latestByFips.get(row.fips);
      if (!existing || new Date(row.mapDate) > new Date(existing.mapDate)) {
        latestByFips.set(row.fips, row);
      }
    }

    for (const row of latestByFips.values()) {
      const level = dominantLevel(row);
      const asOf = row.mapDate.slice(0, 10);
      const { error } = await supabase.rpc("upsert_drought_condition", {
        p_county_fips: row.fips,
        p_level: level,
        p_as_of: asOf,
      });
      if (error) {
        rowsFailed++;
        failures.push(`${row.fips}: ${error.message}`);
      } else {
        rowsUpserted++;
      }
    }
  });

  return {
    rowsUpserted,
    rowsFailed,
    notes: failures.length ? failures.slice(0, 20).join("; ") : null,
  };
}

await withRunLog("drought", run);
