// Seeds public.states from a public-domain state boundary GeoJSON.
// Source: https://github.com/PublicaMundi/MappingAPI (Census-derived, public domain).
// Run: node --env-file=.env.local scripts/ingest/states.mjs
import { supabase, withRunLog } from "./_client.mjs";

const SOURCE_URL =
  "https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json";

const NAME_TO_ABBR = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA",
  Colorado: "CO", Connecticut: "CT", Delaware: "DE", "District of Columbia": "DC",
  Florida: "FL", Georgia: "GA", Hawaii: "HI", Idaho: "ID", Illinois: "IL",
  Indiana: "IN", Iowa: "IA", Kansas: "KS", Kentucky: "KY", Louisiana: "LA",
  Maine: "ME", Maryland: "MD", Massachusetts: "MA", Michigan: "MI", Minnesota: "MN",
  Mississippi: "MS", Missouri: "MO", Montana: "MT", Nebraska: "NE", Nevada: "NV",
  "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
  "North Carolina": "NC", "North Dakota": "ND", Ohio: "OH", Oklahoma: "OK",
  Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI", "South Carolina": "SC",
  "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT", Vermont: "VT",
  Virginia: "VA", Washington: "WA", "West Virginia": "WV", Wisconsin: "WI",
  Wyoming: "WY", "Puerto Rico": "PR",
};

async function run() {
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  const geojson = await res.json();

  let rowsUpserted = 0;
  let rowsFailed = 0;
  const failures = [];

  for (const feature of geojson.features) {
    const name = feature.properties.name;
    const abbr = NAME_TO_ABBR[name];
    if (!abbr) {
      // Skip territories not in our mapping (not a 50-state + DC boundary).
      continue;
    }
    const { error } = await supabase.rpc("upsert_state", {
      p_state: abbr,
      p_name: name,
      p_geojson: feature.geometry,
      p_source: "PublicaMundi/MappingAPI (Census-derived, public domain)",
    });
    if (error) {
      rowsFailed++;
      failures.push(`${abbr}: ${error.message}`);
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

await withRunLog("states", run);
