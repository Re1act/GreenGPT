// Validation for data/organizations.json entries. Pure, so it's unit-tested
// (lib/brief/organizationsFile.test.ts) and the real file is checked in CI-style
// tests before anyone runs the loader.

export const ORG_KINDS = [
  "ratepayer_advocate",
  "utility_commission",
  "local_government",
  "community_group",
  "environmental_group",
  "civic_group",
  "industry_group",
  "other",
];

const ALLOWED_KEYS = new Set([
  "name",
  "kind",
  "website",
  "description",
  "stated_position",
  "states",
  "county_fips",
  "source_url",
  "checked_on",
  "curated_by",
  "verified",
]);

const isUrl = (v) => {
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
};

/** Returns a list of problems; empty means the entry is valid. */
export function validateOrganization(o) {
  const problems = [];
  if (!o || typeof o !== "object") return ["not an object"];

  for (const key of Object.keys(o)) {
    if (!ALLOWED_KEYS.has(key)) problems.push(`unknown field "${key}"`);
  }
  if (typeof o.name !== "string" || !o.name.trim()) problems.push("name is required");
  if (!ORG_KINDS.includes(o.kind)) problems.push(`kind must be one of ${ORG_KINDS.join(", ")}`);
  if (!isUrl(o.website)) problems.push("website must be a full http(s) URL");
  if (!isUrl(o.source_url)) problems.push("source_url must be a full http(s) URL");
  if (typeof o.description !== "string" || o.description.trim().length < 20) {
    problems.push("description must be at least a sentence");
  }
  if (o.stated_position !== null && (typeof o.stated_position !== "string" || !o.stated_position.trim())) {
    problems.push("stated_position must be text or null");
  }
  if (!Array.isArray(o.states) || o.states.length === 0 || !o.states.every((s) => /^[A-Z]{2}$/.test(s))) {
    problems.push('states must be a non-empty list of 2-letter codes, e.g. ["AZ"]');
  }
  if (
    o.county_fips !== null &&
    (!Array.isArray(o.county_fips) || o.county_fips.length === 0 || !o.county_fips.every((f) => /^\d{5}$/.test(f)))
  ) {
    problems.push("county_fips must be null (statewide) or a non-empty list of 5-digit codes");
  }
  if (typeof o.checked_on !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(o.checked_on) || Number.isNaN(Date.parse(o.checked_on))) {
    problems.push("checked_on must be a YYYY-MM-DD date");
  }
  if (typeof o.verified !== "boolean") problems.push("verified must be true or false");
  return problems;
}
