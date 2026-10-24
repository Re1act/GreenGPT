import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateOrganization } from "../../scripts/ingest/_organizations.mjs";

const valid = {
  name: "Example Office",
  kind: "ratepayer_advocate",
  website: "https://example.gov/",
  description: "Represents residential customers in rate cases.",
  stated_position: null,
  states: ["AZ"],
  county_fips: null,
  source_url: "https://www.nasuca.org/members/",
  checked_on: "2026-10-23",
  curated_by: "owner",
  verified: false,
};

describe("validateOrganization", () => {
  it("accepts a complete entry, statewide or county-level", () => {
    expect(validateOrganization(valid)).toEqual([]);
    expect(validateOrganization({ ...valid, county_fips: ["04013", "04019"] })).toEqual([]);
  });

  it("rejects the mistakes most likely in hand-edited JSON", () => {
    expect(validateOrganization({ ...valid, kind: "nonprofit" })).toHaveLength(1);
    expect(validateOrganization({ ...valid, website: "example.gov" })).toHaveLength(1);
    expect(validateOrganization({ ...valid, states: ["Arizona"] })).toHaveLength(1);
    expect(validateOrganization({ ...valid, county_fips: ["4013"] })).toHaveLength(1);
    expect(validateOrganization({ ...valid, county_fips: [] })).toHaveLength(1);
    expect(validateOrganization({ ...valid, checked_on: "10/23/2026" })).toHaveLength(1);
    expect(validateOrganization({ ...valid, verified: "yes" })).toHaveLength(1);
    expect(validateOrganization({ ...valid, stated_position: "" })).toHaveLength(1);
    expect(validateOrganization({ ...valid, website_url: "https://x.org" })).toHaveLength(1);
  });
});

describe("data/organizations.json", () => {
  const file = JSON.parse(readFileSync("data/organizations.json", "utf8"));

  it("contains only valid entries", () => {
    const problems = file.organizations.flatMap((o: { name: string }) =>
      validateOrganization(o).map((p: string) => `${o.name}: ${p}`)
    );
    expect(problems).toEqual([]);
  });

  it("has no duplicate (name, website) pairs, the loader's upsert key", () => {
    const keys = file.organizations.map((o: { name: string; website: string }) => `${o.name}|${o.website}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
