import type { Official } from "@/lib/brief/types";

// Parsers for the two officials sources. Pure functions over the raw responses,
// so they're tested without network access (officials.test.ts).

/** U.S. senators for one state, from senate.gov's contact XML. */
export function parseSenateXml(xml: string, state: string): Official[] {
  const tag = (block: string, name: string) =>
    block.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1]?.trim() ?? "";

  return [...xml.matchAll(/<member>([\s\S]*?)<\/member>/g)]
    .map((m) => m[1])
    .filter((block) => tag(block, "state") === state)
    .map((block) => ({
      name: `${tag(block, "first_name")} ${tag(block, "last_name")}`.trim(),
      role: `U.S. Senator (${SENATE_PARTIES[tag(block, "party")] ?? tag(block, "party")})`,
      approximate: false,
      phone: tag(block, "phone") || null,
      url: tag(block, "website") || "https://www.senate.gov/senators/senators-contact.htm",
    }));
}

type OpenStatesPerson = {
  name?: string;
  party?: string;
  openstates_url?: string;
  current_role?: { title?: string; org_classification?: string; district?: string | number };
  jurisdiction?: { name?: string; classification?: string };
  links?: { url?: string }[];
  offices?: { voice?: string | null }[];
};

const SENATE_PARTIES: Record<string, string> = { D: "Democratic", R: "Republican", I: "Independent" };

/**
 * ", District 4" from "4" or House-style "AZ-4"; ", at-large" for single-district
 * seats; named districts (Vermont's "Washington-5", DC's "Ward 2") keep their name.
 */
function districtLabel(district: string | number | undefined): string {
  if (district === undefined || district === "") return "";
  const d = String(district).replace(/^[A-Z]{2}-/, "");
  if (/^(AL|at-large)$/i.test(d)) return ", at-large";
  if (/^[0-9A-Z]{1,3}$/.test(d)) return `, District ${d}`;
  if (/^(Ward|Chair)/i.test(d)) return `, ${d}`;
  return `, ${d} district`;
}

// DC and Puerto Rico send non-voting members to the House and don't have a
// "state" legislature, so the generic titles would be wrong there.
function titleFor(state: string, federal: boolean, chamber: string | undefined, fallback: string | undefined): string {
  if (federal) {
    if (state === "DC") return "Delegate to the U.S. House (non-voting)";
    if (state === "PR") return "Resident Commissioner in the U.S. House (non-voting)";
    return "U.S. Representative";
  }
  if (state === "DC") return "DC Council member";
  const place = state === "PR" ? "Puerto Rico" : "State";
  if (chamber === "upper" || chamber === "legislature") return `${place} Senator`;
  if (chamber === "lower") return `${place} Representative`;
  return fallback ?? "Legislator";
}

/**
 * Legislators from Open States' /people.geo for the ZIP's representative point.
 * Senators are skipped here because senators come from senate.gov (statewide,
 * not point-matched). District seats are marked approximate: a ZIP can span
 * district lines, so the point's district may not be the reader's.
 */
export function parsePeopleGeo(json: unknown, state: string): Official[] {
  const results = (json as { results?: OpenStatesPerson[] })?.results ?? [];
  const ranked: { official: Official; rank: number }[] = [];

  for (const p of results) {
    if (!p?.name) continue;
    const federal = p.jurisdiction?.classification === "country";
    const chamber = p.current_role?.org_classification;
    if (federal && chamber === "upper") continue;

    const party = p.party ? ` (${p.party})` : "";
    const district = districtLabel(p.current_role?.district);
    ranked.push({
      // House member first, then the upper chamber, then the lower.
      rank: federal ? 0 : chamber === "lower" ? 2 : 1,
      official: {
        name: p.name,
        role: `${titleFor(state, federal, chamber, p.current_role?.title)}${district}${party}`,
        // At-large seats and DC's council chair cover everyone, so the ZIP's point can't miss.
        approximate: !/^, (at-large|Chair)/.test(district),
        phone: p.offices?.map((o) => o.voice).find(Boolean) ?? null,
        url:
          p.links?.map((l) => l.url).find(Boolean) ?? p.openstates_url ?? "https://openstates.org/find_your_legislator/",
      },
    });
  }

  return ranked.sort((a, b) => a.rank - b.rank).map((r) => r.official);
}
