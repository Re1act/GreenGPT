// Seeds public.facilities with a small, carefully-sourced starter set for Arizona --
// the MVP's "one state researched to full depth" pilot (chosen because the brief
// itself leans on AZ examples throughout: Chandler's water cap, Marana's ban,
// Tucson's Project Blue rejection). This is a STARTER set, not full depth: five
// real, publicly-reported facilities with a real citation each, not a complete
// survey of Arizona's data center buildout. Flagged for review before this is
// treated as authoritative -- see the ingestion summary for what's still missing.
//
// Every row omits any figure (MW, cooling type, build year) that wasn't stated
// in its cited source, rather than estimating. `confidence` notes where a status
// or figure might be stale (most of these sources are from 2023-2026 and this
// industry moves fast) and that coordinates are city/corridor-level
// approximations, not parcel-surveyed -- consistent with the brief's stance that
// this data is curated, not authoritative (see supabase/migrations/..._facilities.sql).
// Run: node --env-file=.env.local scripts/ingest/facilities-az.mjs
import { createHash } from "node:crypto";
import { supabase, withRunLog } from "./_client.mjs";

// Deterministic id from the facility name, so re-running this script upserts the
// same 5 rows instead of inserting duplicates each time (the upsert_facility RPC
// conflicts on id, and a fresh random uuid per run would defeat that).
function stableId(name) {
  const hash = createHash("sha1").update(name).digest("hex");
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    "5" + hash.slice(13, 16), // version 5-ish marker
    ((parseInt(hash[16], 16) & 0x3) | 0x8).toString(16) + hash.slice(17, 20),
    hash.slice(20, 32),
  ].join("-");
}

const MARICOPA_FIPS = "04013";
const PIMA_FIPS = "04019";
const CURATED_BY = "turquiose345@gmail.com (manual research, Aug 2026)";
const COORD_CAVEAT = "coordinates are city/corridor-level approximations, not parcel-surveyed";

const FACILITIES = [
  {
    name: "Project Blue",
    operator: "Beale Infrastructure",
    lon: -110.752,
    lat: 32.121,
    state: "AZ",
    county_fips: PIMA_FIPS,
    status: "contested",
    announced_load_mw: null,
    cooling_type: "closed_loop",
    power_source: null,
    build_year: null,
    applicable_local_policy:
      "City of Tucson rejected the original permit application (which used evaporative cooling and Tucson Water); Beale committed to a closed-loop, zero-potable-water design afterward. Pima County (not the city) separately approved advancing the project on county land near the Pima County Fairgrounds; construction and well-drilling began in 2026 amid ongoing protest.",
    opposition_note:
      "Actively contested: community protests continued as construction began (April 2026); developer has declined to fully disclose its water sourcing plan.",
    source_name: "AZ Luminaria",
    source_url:
      "https://azluminaria.org/2026/04/24/we-said-no-dozens-protest-as-construction-of-project-blue-data-center-begins/",
    source_date: "2026-04-24",
    confidence: `reported; ${COORD_CAVEAT}`,
  },
  {
    name: "Microsoft Goodyear Campus",
    operator: "Microsoft",
    lon: -112.396,
    lat: 33.418,
    state: "AZ",
    county_fips: MARICOPA_FIPS,
    status: "operating",
    announced_load_mw: null,
    cooling_type: "evaporative",
    power_source: null,
    build_year: null,
    applicable_local_policy:
      "City of Goodyear agreement: Microsoft's first three buildings on this campus may continue water cooling (recirculating), but the 4th and 5th buildings are required to use air cooling due to high total dissolved solids in the local water supply. Microsoft is paying $36M toward a $90M expansion of the city's wastewater treatment plant.",
    opposition_note: null,
    source_name: "Arizona Technology Council",
    source_url:
      "https://www.aztechcouncil.org/microsoft-agrees-to-make-data-centers-air-cooled-amid-water-infrastructure-challenges-in-goodyear/",
    source_date: "2023-03-06",
    confidence: `reported as of the cited 2023 city council approval; cooling_type reflects buildings 1-3 (buildings 4-5 will be air-cooled per policy above); MW load and current buildout stage not reverified for 2026; ${COORD_CAVEAT}`,
  },
  {
    name: "Vantage Data Centers Goodyear Campus",
    operator: "Vantage Data Centers",
    lon: -112.37,
    lat: 33.435,
    state: "AZ",
    county_fips: MARICOPA_FIPS,
    status: "under_construction",
    announced_load_mw: 176,
    cooling_type: null,
    power_source: null,
    build_year: 2024,
    applicable_local_policy: null,
    opposition_note: null,
    source_name: "Data Center Frontier",
    source_url:
      "https://www.datacenterfrontier.com/site-selection/article/33011236/land-and-expand-google-vantage-data-centers-microsoft",
    source_date: "2023-09-08",
    confidence: `reported as of Phase II topping-out (July 2023), targeted operational spring 2024; not reverified for current 2026 status; 176MW is total across all three campus buildings, not per-building; ${COORD_CAVEAT}`,
  },
  {
    name: "Google Mesa Data Center",
    operator: "Google",
    lon: -111.628,
    lat: 33.351,
    state: "AZ",
    county_fips: MARICOPA_FIPS,
    status: "under_construction",
    announced_load_mw: null,
    cooling_type: "air",
    power_source: null,
    build_year: 2025,
    applicable_local_policy: null,
    opposition_note: null,
    source_name: "Data Center Frontier",
    source_url:
      "https://www.datacenterfrontier.com/site-selection/article/33011236/land-and-expand-google-vantage-data-centers-microsoft",
    source_date: "2023-09-08",
    confidence: `reported at groundbreaking (Sept 2023); cooling described as "water-free," classified here as air cooling; targeted completion "early 2025" not reverified for current 2026 status; ${COORD_CAVEAT}`,
  },
  {
    name: "EdgeConneX Elliot Road Campus",
    operator: "EdgeConneX",
    lon: -111.716,
    lat: 33.348,
    state: "AZ",
    county_fips: MARICOPA_FIPS,
    status: "proposed",
    announced_load_mw: null,
    cooling_type: null,
    power_source: null,
    build_year: null,
    applicable_local_policy: null,
    opposition_note: null,
    source_name: "Data Center Dynamics",
    source_url:
      "https://www.datacenterdynamics.com/en/news/edgeconnex-files-for-new-1-million-sq-ft-data-center-campus-in-mesa-arizona/",
    source_date: "2023-09-06",
    confidence: `reported at filing (city administrative/design review, Sept 2023); 3 proposed buildings + 1 substation, ~93 acres, 1M+ sqft if fully built; approval/construction status not reverified for 2026; ${COORD_CAVEAT}`,
  },
];

async function run() {
  let rowsUpserted = 0;
  let rowsFailed = 0;
  const failures = [];

  for (const f of FACILITIES) {
    const { error } = await supabase.rpc("upsert_facility", {
      p_id: stableId(f.name),
      p_name: f.name,
      p_operator: f.operator,
      p_lon: f.lon,
      p_lat: f.lat,
      p_state: f.state,
      p_county_fips: f.county_fips,
      p_status: f.status,
      p_announced_load_mw: f.announced_load_mw,
      p_cooling_type: f.cooling_type,
      p_power_source: f.power_source,
      p_build_year: f.build_year,
      p_applicable_local_policy: f.applicable_local_policy,
      p_opposition_note: f.opposition_note,
      p_source_name: f.source_name,
      p_source_url: f.source_url,
      p_source_date: f.source_date,
      p_curated_by: CURATED_BY,
      p_confidence: f.confidence,
    });
    if (error) {
      rowsFailed++;
      failures.push(`${f.name}: ${error.message}`);
    } else {
      rowsUpserted++;
    }
  }

  return {
    rowsUpserted,
    rowsFailed,
    notes: failures.length ? failures.join("; ") : "Starter set of 5 AZ facilities -- not a complete survey.",
  };
}

await withRunLog("facilities_az_starter", run);
