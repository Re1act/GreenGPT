import "server-only";
import { supabaseAnon } from "@/lib/supabase/anon";
import { facilityScenarioHref } from "@/lib/simulator/params";
import { billStatusLabel, isOfficialChannel, orgKindLabel, staleBillNote } from "@/lib/brief/helpers";
import { parsePeopleGeo, parseSenateXml } from "@/lib/brief/officials";
import type {
  BriefBill,
  BriefFacility,
  BriefOrganization,
  Official,
  Place,
  Section,
} from "@/lib/brief/types";

// Server-side data access for the Local Brief. Each function covers one
// section and throws on failure; the route turns a failure into a coverage
// note instead of failing the whole brief.

const STATE_NAMES_FALLBACK = "this state";

// --- ZIP -> place -------------------------------------------------------------
// Primary: the seeded Census ZCTA table (state + county, no outside call).
// Fallback: Zippopotam.us, for ZIPs that aren't ZCTAs (PO boxes) or before the
// table is seeded. The fallback has no county, so county-level organizations
// won't match for those ZIPs -- statewide ones still do.

type ZipRow = {
  zip: string;
  state: string;
  state_name: string | null;
  county_fips: string | null;
  county_name: string | null;
  lat: number;
  lon: number;
};

async function lookupZipCensus(zip: string): Promise<Place | null> {
  const { data, error } = await supabaseAnon.rpc("zip_lookup", { p_zip: zip });
  if (error || !data) return null; // includes "migration not applied yet"
  const row = data as ZipRow;
  return {
    zip,
    label: row.county_name ? `${row.county_name}, ${row.state}` : row.state,
    state: row.state,
    stateName: row.state_name ?? row.state,
    countyFips: row.county_fips,
    countyName: row.county_name,
    lat: row.lat,
    lon: row.lon,
    source: "census",
  };
}

async function lookupZipGeocoder(zip: string): Promise<Place> {
  const res = await fetch(`https://api.zippopotam.us/us/${zip}`, { signal: AbortSignal.timeout(10_000) });
  if (res.status === 404) throw new Error("NOT_FOUND");
  if (!res.ok) throw new Error(`Geocoder failed: ${res.status}`);
  const data = await res.json();
  const p = data?.places?.[0];
  const lat = Number(p?.latitude);
  const lon = Number(p?.longitude);
  // Zippopotam pads some fields with trailing spaces ("MP ").
  const state = String(p?.["state abbreviation"] ?? "").trim();
  if (!p || !state || !Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error("NOT_FOUND");
  return {
    zip,
    label: `${String(p["place name"]).trim()}, ${state}`,
    state,
    stateName: String(p.state ?? "").trim() || STATE_NAMES_FALLBACK,
    countyFips: null,
    countyName: null,
    lat,
    lon,
    source: "geocoder",
  };
}

export async function lookupZip(zip: string): Promise<Place> {
  return (await lookupZipCensus(zip)) ?? lookupZipGeocoder(zip);
}

// --- Facilities -------------------------------------------------------------

type FacilityRow = {
  id: string;
  name: string;
  operator: string | null;
  status: string | null;
  announced_load_mw: number | null;
  cooling_type: string | null;
  build_year: number | null;
  source_name: string | null;
  source_url: string | null;
  source_date: string | null;
  distance_miles: number;
  lat: number;
  lon: number;
};

export async function nearby(place: Place, radius: number): Promise<Section<BriefFacility>> {
  const { data, error } = await supabaseAnon.rpc("facilities_near_point", {
    p_lon: place.lon,
    p_lat: place.lat,
    p_radius_miles: radius,
  });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as FacilityRow[];
  return {
    available: true,
    note: rows.length
      ? "From Kilowatch's facility registry: hand-checked records plus Data Center Watch's national list. No registry is complete, so check local news and planning agendas too."
      : `No facilities in our registry within ${radius} miles. Our registry is incomplete, so this doesn't mean none are planned. Check your county's planning agendas.`,
    items: rows.map((f) => ({
      id: f.id,
      name: f.name,
      operator: f.operator,
      status: f.status,
      announced_load_mw: f.announced_load_mw,
      distance: f.distance_miles,
      source_name: f.source_name,
      source_url: f.source_url,
      source_date: f.source_date,
      mapHref: `/map?facility=${encodeURIComponent(f.id)}`,
      simulateHref: facilityScenarioHref({
        name: f.name,
        lat: f.lat,
        lon: f.lon,
        announcedLoadMW: f.announced_load_mw,
        coolingType: f.cooling_type,
        buildYear: f.build_year,
      }),
    })),
  };
}

// --- Legislation ------------------------------------------------------------
// Read from state_legislation, which scripts/ingest/legislation-openstates.mjs
// refreshes. The last successful run's date is shown so stale data is visible.

type BillRow = {
  id: string;
  bill_number: string;
  title: string;
  session: string;
  sponsor: string | null;
  status: string;
  summary: string;
  summary_source: string | null;
  source_url: string;
  last_action_date: string | null;
  last_action_text: string | null;
  updated_at: string;
};

export async function legislation(place: Place): Promise<Section<BriefBill>> {
  const [{ data, error }, { data: runs }] = await Promise.all([
    supabaseAnon
      .from("state_legislation")
      .select(
        "id, bill_number, title, session, sponsor, status, summary, summary_source, source_url, last_action_date, last_action_text, updated_at"
      )
      .eq("state", place.state)
      .order("last_action_date", { ascending: false, nullsFirst: false })
      .limit(25),
    supabaseAnon
      .from("ingestion_runs")
      .select("finished_at")
      .eq("source_name", "openstates_legislation")
      .in("status", ["success", "partial"])
      .order("finished_at", { ascending: false })
      .limit(1),
  ]);
  if (error) throw new Error(error.message);

  const lastRun = runs?.[0]?.finished_at as string | undefined;
  if (!lastRun) {
    return {
      items: [],
      available: false,
      note: "Bill tracking hasn't been loaded yet. Use the state bill search below for now.",
    };
  }

  const refreshed = new Date(lastRun).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const rows = (data ?? []) as BillRow[];
  return {
    available: true,
    note: rows.length
      ? `Bills about data centers or large power customers, from Open States, updated ${refreshed}. Status comes from each bill's recorded actions; check the linked record for the latest.`
      : `No ${place.stateName} bills about data centers found in Open States since 2025 (updated ${refreshed}). Bills that describe data centers in other terms may be missed.`,
    items: rows.map((b) => ({
      id: b.id,
      number: b.bill_number,
      title: b.title,
      session: b.session,
      sponsor: b.sponsor ?? "Sponsor not listed",
      status: [billStatusLabel(b.status), b.last_action_text && `latest action: ${b.last_action_text}`]
        .filter(Boolean)
        .join(" · "),
      summary: b.summary,
      summaryKind:
        b.summary_source === "abstract"
          ? "Official abstract via Open States"
          : "No official summary available, so this repeats the bill's title",
      staleNote: staleBillNote(b.status, b.last_action_date),
      updated: b.last_action_date ?? b.updated_at,
      source: b.source_url,
    })),
  };
}

// --- Officials --------------------------------------------------------------
// Small in-memory caches: the Senate list changes rarely, and people.geo is
// keyed by the ZIP's point, so repeat lookups of the same ZIP are free.

const DAY = 86_400_000;
let senateCache: { xml: string; expires: number } | null = null;
const peopleCache = new Map<string, { officials: Official[]; expires: number }>();

export async function senators(state: string): Promise<Official[]> {
  if (!senateCache || senateCache.expires < Date.now()) {
    const res = await fetch("https://www.senate.gov/general/contact_information/senators_cfm.xml", {
      signal: AbortSignal.timeout(10_000),
      headers: { "User-Agent": "Kilowatch/0.1 (local brief)" },
    });
    if (!res.ok) throw new Error(`senate.gov ${res.status}`);
    senateCache = { xml: await res.text(), expires: Date.now() + DAY };
  }
  return parseSenateXml(senateCache.xml, state);
}

/** State legislators (and the U.S. House member, if Open States returns one). */
export async function stateOfficials(place: Place): Promise<Official[]> {
  const key = process.env.OPENSTATES_API_KEY;
  if (!key) return [];
  const cacheKey = `${place.lat.toFixed(3)},${place.lon.toFixed(3)}`;
  const cached = peopleCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.officials;

  const url = new URL("https://v3.openstates.org/people.geo");
  url.searchParams.set("lat", String(place.lat));
  url.searchParams.set("lng", String(place.lon));
  url.searchParams.append("include", "links");
  url.searchParams.append("include", "offices");
  const res = await fetch(url, { headers: { "X-API-KEY": key }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Open States people.geo ${res.status}`);
  const officials = parsePeopleGeo(await res.json(), place.state);

  if (peopleCache.size >= 1000) peopleCache.delete(peopleCache.keys().next().value!);
  peopleCache.set(cacheKey, { officials, expires: Date.now() + DAY });
  return officials;
}

// --- Organizations ----------------------------------------------------------

type OrgRow = {
  id: string;
  name: string;
  kind: string;
  website: string;
  description: string;
  stated_position: string | null;
  states: string[];
  county_fips: string[] | null;
  source_url: string;
  checked_on: string;
};

export async function organizations(place: Place): Promise<Section<BriefOrganization>> {
  const { data, error } = await supabaseAnon.rpc("organizations_for_place", {
    p_state: place.state,
    p_county_fips: place.countyFips,
  });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as OrgRow[];
  const hasGroups = rows.some((o) => !isOfficialChannel(o.kind));
  return {
    available: true,
    note: [
      rows.some((o) => o.kind === "ratepayer_advocate")
        ? "Your state's utility consumer advocate represents customers like you in rate cases, and can tell you which cases are open."
        : `We don't list a utility consumer advocate office for ${place.stateName}, so your utility regulator (section 03) is the place to start.`,
      hasGroups
        ? "Community groups are listed with their stated position on data centers in their own words. Listing isn't an endorsement, and this isn't a complete directory."
        : `We haven't verified local community groups for ${place.label} yet. That's a gap in our coverage, not a sign that no one is organizing locally.`,
    ].join(" "),
    items: rows.map((o) => ({
      id: o.id,
      name: o.name,
      kind: o.kind,
      kindLabel: orgKindLabel(o.kind),
      official: isOfficialChannel(o.kind),
      website: o.website,
      description: o.description,
      statedPosition: o.stated_position,
      scope: o.county_fips?.length ? `Serves ${place.countyName ?? "this county"}` : `Statewide (${o.states.join(", ")})`,
      source: o.source_url,
      checked: o.checked_on,
    })),
  };
}
