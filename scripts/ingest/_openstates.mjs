// Pure helpers for the Open States v3 bills ingest: which jurisdictions to
// search, which results really are about data centers, how Open States action
// classifications map onto our bill_status enum, and the row shape for
// public.state_legislation. No network or database access here, so it's
// unit-tested directly (lib/brief/openstatesIngest.test.ts).
import { STATE_FIPS_TO_ABBR } from "./_stateFips.mjs";

// Open States covers the 50 states, DC, and Puerto Rico -- not the other
// territories that appear in the Census FIPS table.
const NOT_COVERED = new Set(["AS", "GU", "MP", "VI"]);

export const JURISDICTIONS = Object.values(STATE_FIPS_TO_ABBR)
  .filter((abbr) => !NOT_COVERED.has(abbr))
  .map((abbr) => {
    const lower = abbr.toLowerCase();
    const kind = abbr === "DC" ? "district" : abbr === "PR" ? "territory" : "state";
    return { abbr, id: `ocd-jurisdiction/country:us/${kind}:${lower}/government` };
  });

// The API search is a phrase search for "data center", which also matches bills
// that only mention data centers in passing (tax omnibus bills, technical
// corrections). So every result is re-checked: a bill is kept only when its
// title, abstracts, or subjects name one of these terms. "Large load" and
// "co-location" catch the utility-tariff and power-plant bills that are about
// data centers without saying so in the title.
const TERMS = [
  ["data center", /\bdata[\s-]?cent(?:er|re)s?\b|\bdatacent(?:er|re)s?\b/i],
  ["large load", /\blarge[\s-]load\b/i],
  ["hyperscale", /\bhyperscale/i],
  ["co-location", /\bco-?locat(?:ion|ed|e)\b/i],
];

/** Which TERMS a bill's title, abstracts, or subjects mention; empty = not relevant. */
export function matchedTerms(bill) {
  const haystack = [
    bill.title,
    ...(bill.abstracts ?? []).map((a) => a.abstract),
    ...(bill.subject ?? []),
  ]
    .filter(Boolean)
    .join(" \n ");
  return TERMS.filter(([, re]) => re.test(haystack)).map(([term]) => term);
}

export function matchesDataCenters(bill) {
  return matchedTerms(bill).length > 0;
}

const has = (actions, ...names) =>
  actions.some((a) => (a.classification ?? []).some((c) => names.includes(c)));

/**
 * Collapse a bill's Open States action history into one bill_status value.
 * Terminal outcomes win (law, veto); otherwise the furthest stage reached,
 * unless the most recent classified action was a failure or withdrawal.
 */
export function billStatus(actions = []) {
  const sorted = [...actions].sort((a, b) => String(a.date).localeCompare(String(b.date)));

  if (has(sorted, "became-law", "executive-signature", "veto-override-passage")) return "enacted";
  if (has(sorted, "executive-veto")) return "vetoed";

  const latestClassified = [...sorted].reverse().find((a) => (a.classification ?? []).length > 0);
  if (latestClassified && has([latestClassified], "failure", "withdrawal", "committee-failure")) {
    return "failed";
  }

  const passedChambers = new Set(
    sorted
      .filter((a) => (a.classification ?? []).includes("passage"))
      .map((a) => a.organization?.classification ?? "unknown")
  );
  // Nebraska is unicameral: one "legislature" passage is final passage.
  if (passedChambers.has("legislature") || passedChambers.size >= 2) return "passed_legislature";
  if (passedChambers.size === 1) return "passed_chamber";
  if (has(sorted, "committee-passage", "committee-passage-favorable")) return "passed_committee";
  if (has(sorted, "referral-committee")) return "in_committee";
  return "introduced";
}

/** Map one Open States bill to a public.state_legislation row. */
export function toLegislationRow(bill, stateAbbr) {
  const abstract = (bill.abstracts ?? []).map((a) => a.abstract?.trim()).find(Boolean);
  const sponsors = (bill.sponsorships ?? [])
    .filter((s) => s.primary)
    .map((s) => s.name)
    .filter(Boolean);
  const officialSource = (bill.sources ?? []).map((s) => s.url).find(Boolean);

  return {
    openstates_id: bill.id,
    state: stateAbbr,
    session: String(bill.session),
    bill_number: bill.identifier,
    sponsor: sponsors.length ? sponsors.join(", ") : null,
    status: billStatus(bill.actions),
    title: bill.title,
    summary: abstract ?? bill.title,
    summary_source: abstract ? "abstract" : "title",
    source_url: officialSource ?? bill.openstates_url,
    openstates_url: bill.openstates_url ?? null,
    last_action_date: bill.latest_action_date ? String(bill.latest_action_date).slice(0, 10) : null,
    last_action_text: bill.latest_action_description ?? null,
    matched_terms: matchedTerms(bill),
    updated_at: new Date().toISOString(),
  };
}
