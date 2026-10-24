// Refreshes public.state_legislation with data center bills from the Open
// States v3 API, for every state plus DC and Puerto Rico. Meant to run on a
// schedule (nightly is plenty): the Local Brief reads this table instead of
// calling Open States per visitor, which keeps the API key server-side, keeps
// page loads fast, and means an Open States outage never shows up as "no bills".
//
// Search: the quoted phrase "data center" per jurisdiction, limited to bills
// with any action since ACTION_SINCE, then re-filtered locally
// (matchesDataCenters) to drop bills that only mention data centers in passing.
// Unquoted, the search matches any bill containing both words anywhere -- 180
// Arizona bills versus 52 for the phrase -- and the real ones fell past the
// page limit.
// Requests are spaced out to stay well inside Open States' rate limits; tune
// with OPENSTATES_DELAY_MS if your key's tier allows more.
// Requires OPENSTATES_API_KEY in .env.local (free key: https://open.pluralpolicy.com/accounts/profile/).
// Run: node --env-file=.env.local scripts/ingest/legislation-openstates.mjs
import { supabase, withRunLog } from "./_client.mjs";
import { JURISDICTIONS, matchesDataCenters, toLegislationRow } from "./_openstates.mjs";

const API = "https://v3.openstates.org/bills";
const ACTION_SINCE = process.env.OPENSTATES_ACTION_SINCE ?? "2025-01-01";
const DELAY_MS = Number(process.env.OPENSTATES_DELAY_MS ?? 6500);
const MAX_PAGES = 10; // 20 per page -> up to 200 candidate bills per state

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchPage(jurisdictionId, page) {
  const url = new URL(API);
  const params = url.searchParams;
  params.set("jurisdiction", jurisdictionId);
  params.set("q", '"data center"');
  params.set("action_since", ACTION_SINCE);
  params.set("sort", "latest_action_desc");
  params.set("per_page", "20");
  params.set("page", String(page));
  for (const include of ["sponsorships", "abstracts", "actions", "sources"]) {
    params.append("include", include);
  }

  // Retries rate limits, server errors, and dropped connections; a full run is
  // ~150 requests over 15+ minutes, so one network blip shouldn't lose a state.
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt++) {
    let res;
    try {
      res = await fetch(url, {
        headers: { "X-API-KEY": process.env.OPENSTATES_API_KEY },
        signal: AbortSignal.timeout(60_000),
      });
    } catch (err) {
      lastError = err;
      console.log(`[openstates] network error (${err.cause?.code ?? err.message}); retrying in ${15 * attempt}s`);
      await sleep(15_000 * attempt);
      continue;
    }
    if (res.status === 429) {
      const wait = Number(res.headers.get("retry-after") ?? 60) * 1000;
      console.log(`[openstates] rate limited; waiting ${wait / 1000}s`);
      lastError = new Error("rate limited");
      await sleep(wait);
      continue;
    }
    if (res.status >= 500) {
      lastError = new Error(`${res.status} ${res.statusText}`);
      console.log(`[openstates] ${res.status}; retrying in ${15 * attempt}s`);
      await sleep(15_000 * attempt);
      continue;
    }
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${(await res.text()).slice(0, 200)}`);
    return res.json();
  }
  throw new Error(`gave up after 4 attempts: ${lastError?.message}`);
}

async function run() {
  if (!process.env.OPENSTATES_API_KEY) {
    throw new Error("Missing OPENSTATES_API_KEY. Add it to .env.local and rerun.");
  }

  let rowsUpserted = 0;
  let rowsFailed = 0;
  const failures = [];
  const perState = [];

  // OPENSTATES_STATES=AL,AK reruns just those states (e.g. after a partial run).
  const only = process.env.OPENSTATES_STATES?.split(",").map((s) => s.trim().toUpperCase());
  const jurisdictions = only ? JURISDICTIONS.filter((j) => only.includes(j.abbr)) : JURISDICTIONS;

  for (const { abbr, id } of jurisdictions) {
    // Keyed by bill id: results are sorted by latest action, so a bill acted on
    // mid-run can shift onto the next page and come back twice, and Postgres
    // rejects an upsert that touches the same row twice.
    const rows = new Map();
    try {
      for (let page = 1; page <= MAX_PAGES; page++) {
        const data = await fetchPage(id, page);
        await sleep(DELAY_MS);
        for (const bill of data.results ?? []) {
          if (matchesDataCenters(bill)) rows.set(bill.id, toLegislationRow(bill, abbr));
        }
        if (page >= (data.pagination?.max_page ?? 1)) break;
      }
    } catch (err) {
      rowsFailed++;
      failures.push(`${abbr}: ${err.message}`);
      console.log(`[openstates] ${abbr}: FAILED ${err.message}`);
      continue;
    }

    if (rows.size) {
      const { error } = await supabase
        .from("state_legislation")
        .upsert([...rows.values()], { onConflict: "openstates_id" });
      if (error) {
        rowsFailed += rows.size;
        failures.push(`${abbr} upsert: ${error.message}`);
        console.log(`[openstates] ${abbr}: FAILED to save: ${error.message}`);
        continue;
      }
      rowsUpserted += rows.size;
    }
    perState.push(`${abbr}:${rows.size}`);
    console.log(`[openstates] ${abbr}: ${rows.size} data center bills`);
  }

  return {
    rowsUpserted,
    rowsFailed,
    notes: [failures.length ? failures.join("; ") : null, `per state ${perState.join(" ")}`]
      .filter(Boolean)
      .join(" | "),
  };
}

await withRunLog("openstates_legislation", run);
