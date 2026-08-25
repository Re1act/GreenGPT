// Seeds public.facilities in bulk from Data Center Watch's national facility
// registry export -- the same organization the brief already cites for local
// opposition tracking, extended here to general facility coverage. Reviewed
// and approved for this use directly by the project owner (no terms page was
// found stating restrictions against use).
// Source: https://datacentr.net/ (exports at /data/facilities.json)
// Citation: every row keeps its own per-record citation where Data Center Watch
// provides one (they compile from FracTracker, ATLAS, OSM, PeeringDB, Epoch AI,
// and direct news monitoring), with "(via Data Center Watch)" appended so the
// aggregator is always credited alongside the primary source -- not just a
// blanket citation, matching the brief's per-record sourcing requirement.
//
// Scope decisions:
// - US only (country === "United States").
// - Must have name + lat + lng -- rows without coordinates can't be mapped and
//   there's no reliable fallback (unlike state, which we can resolve from
//   coordinates; there's no equivalent trick for missing coordinates).
// - Arizona is excluded here on purpose: the hand-curated 5-facility AZ set
//   (scripts/ingest/facilities-az.mjs) is this project's "one state researched
//   to full depth" MVP demonstration, individually verified with a specific
//   citation per fact. Re-ingesting AZ from the bulk source would sit
//   duplicate, lower-confidence pins right on top of those without any
//   reconciliation logic (this script does no entity resolution against
//   existing rows) -- excluding it here is simpler and more honest than
//   pretending to merge them.
// - `state` is deliberately left to the upsert_facility RPC's point-in-polygon
//   fallback rather than trusting Data Center Watch's own state field, which
//   mixes 2-letter codes, full state names, city names, and blanks.
// Run: node --env-file=.env.local scripts/ingest/facilities-dcw.mjs
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { supabase, withRunLog } from "./_client.mjs";
import { mapWithConcurrency } from "./_stateFips.mjs";

const SOURCE_URL = "https://datacentr.net/data/facilities.json";
const DCW_SITE_URL = "https://datacentr.net/";
const TMP_DIR = ".tmp-ingest";
const JSON_PATH = `${TMP_DIR}/dcw_facilities.json`;

const AZ_STATE_RE = /^AZ$|arizona/i;
const AZ_CITY_RE = /phoenix|tucson|mesa|chandler|goodyear|scottsdale|tempe/i;

// Data Center Watch's status_canonical is a 4-way collapse (their raw `status`
// carries more nuance -- e.g. "approved/permitted/under construction" all
// collapse to in_build -- but parsing that free text reliably isn't worth it
// for a bulk import). This means bulk-sourced rows can only ever land in one
// of these four facility_status values; "approved", "contested", and "delayed"
// remain distinctions only the hand-curated rows currently capture.
const STATUS_MAP = {
  operational: "operating",
  in_build: "under_construction",
  proposed: "proposed",
  cancelled: "cancelled",
};

// Sparse field (~100 of 11,000+ US rows) and free text on their side; mapped
// to our controlled vocabulary with a couple of judgment calls flagged below.
const COOLING_MAP = {
  "closed loop": "closed_loop",
  air: "air",
  fans: "air", // fan-based cooling reads as air cooling
  water: "evaporative", // "water cooling" in DC context is conventionally evaporative-tower cooling
  "open loop": "evaporative", // once-through/open water cooling approximated as evaporative, not closed_loop
  // "hybrid air/water" has no single-value fit in our enum -- left undisclosed (null)
  // rather than picking one arm of a genuinely mixed system.
};

function stableId(facilityId) {
  const hash = createHash("sha1").update(`dcw:${facilityId}`).digest("hex");
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    "5" + hash.slice(13, 16),
    ((parseInt(hash[16], 16) & 0x3) | 0x8).toString(16) + hash.slice(17, 20),
    hash.slice(20, 32),
  ].join("-");
}

function parseAsOfDate(asOf) {
  // Observed format: "MM/DD/YYYY"
  if (!asOf) return null;
  const m = asOf.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, mm, dd, yyyy] = m;
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

async function ensureSourceFile() {
  mkdirSync(TMP_DIR, { recursive: true });
  if (existsSync(JSON_PATH)) return;
  console.log("[facilities_dcw] downloading Data Center Watch export (~22MB)...");
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(JSON_PATH));
}

async function run() {
  await ensureSourceFile();
  const { readFileSync } = await import("node:fs");
  const raw = JSON.parse(readFileSync(JSON_PATH, "utf8"));
  const all = raw.facilities || raw.data || Object.values(raw)[0];

  const rows = all.filter((f) => {
    if (f.country !== "United States") return false;
    if (f.lat == null || f.lng == null || !f.name) return false;
    if (AZ_STATE_RE.test(f.state_region || "") || AZ_CITY_RE.test(f.city || "")) return false;
    if (!STATUS_MAP[f.status_canonical]) return false; // skip anything outside the 4 known canonical values
    return true;
  });

  let rowsUpserted = 0;
  let rowsFailed = 0;
  const failures = [];

  await mapWithConcurrency(rows, 15, async (f) => {
    const sourceName = f.source ? `${f.source} (via Data Center Watch)` : "Data Center Watch";
    const sourceUrl = f.source_url || DCW_SITE_URL;
    const sourceDate = parseAsOfDate(f.as_of) ?? new Date().toISOString().slice(0, 10);
    const coolingType = f.cooling_type ? COOLING_MAP[f.cooling_type.toLowerCase()] ?? null : null;

    const confidenceParts = [
      "bulk-ingested from Data Center Watch's aggregate export, not individually verified",
    ];
    if (f.notes) confidenceParts.push(`notes: ${f.notes}`);

    const { error } = await supabase.rpc("upsert_facility", {
      p_id: stableId(f.facility_id),
      p_name: f.name,
      p_operator: f.operator || f.owner || null,
      p_lon: f.lng,
      p_lat: f.lat,
      p_state: null, // resolved server-side from coordinates -- see migration comment
      p_county_fips: null,
      p_status: STATUS_MAP[f.status_canonical],
      p_announced_load_mw: typeof f.mw === "number" ? f.mw : null,
      p_cooling_type: coolingType,
      p_power_source: f.power_source || null,
      p_build_year: null,
      p_applicable_local_policy: null,
      p_opposition_note: null,
      p_source_name: sourceName,
      p_source_url: sourceUrl,
      p_source_date: sourceDate,
      p_curated_by: "Data Center Watch bulk ingestion",
      p_confidence: confidenceParts.join("; "),
    });

    if (error) {
      rowsFailed++;
      failures.push(`${f.facility_id} (${f.name}): ${error.message}`);
    } else {
      rowsUpserted++;
    }
  });

  return {
    rowsUpserted,
    rowsFailed,
    notes: [
      `${rows.length} candidate rows after filtering (US, geocoded, named, non-AZ, known status)`,
      failures.length ? failures.slice(0, 20).join("; ") : null,
    ]
      .filter(Boolean)
      .join(" | "),
  };
}

await withRunLog("facilities_dcw", run);
