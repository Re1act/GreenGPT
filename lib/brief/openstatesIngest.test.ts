import { describe, expect, it } from "vitest";
import {
  JURISDICTIONS,
  billStatus,
  matchedTerms,
  matchesDataCenters,
  toLegislationRow,
} from "../../scripts/ingest/_openstates.mjs";
import { parseGazetteer, parseZctaCounty } from "../../scripts/ingest/_gazetteer.mjs";

const act = (date: string, classification: string[], chamber?: string) => ({
  date,
  classification,
  organization: chamber ? { classification: chamber } : undefined,
});

describe("JURISDICTIONS", () => {
  it("covers the 50 states, DC, and Puerto Rico with Open States ids", () => {
    expect(JURISDICTIONS).toHaveLength(52);
    expect(JURISDICTIONS.find((j) => j.abbr === "AZ")?.id).toBe("ocd-jurisdiction/country:us/state:az/government");
    expect(JURISDICTIONS.find((j) => j.abbr === "DC")?.id).toBe("ocd-jurisdiction/country:us/district:dc/government");
    expect(JURISDICTIONS.find((j) => j.abbr === "PR")?.id).toBe("ocd-jurisdiction/country:us/territory:pr/government");
    expect(JURISDICTIONS.some((j) => j.abbr === "GU")).toBe(false);
  });
});

describe("matchesDataCenters", () => {
  it("matches spelling variants in titles, abstracts, and subjects", () => {
    expect(matchesDataCenters({ title: "Relating to data centers; water use" })).toBe(true);
    expect(matchesDataCenters({ title: "Tax credits", abstracts: [{ abstract: "Exempts datacenter equipment" }] })).toBe(true);
    expect(matchesDataCenters({ title: "Energy", subject: ["Data Centres"] })).toBe(true);
  });

  it("rejects bills that only contain both words separately", () => {
    expect(matchesDataCenters({ title: "Community center funding; voter data privacy" })).toBe(false);
  });

  it("keeps large-load and co-location bills that don't say data center in the title", () => {
    expect(matchedTerms({ title: "large load customers; energy costs" })).toEqual(["large load"]);
    expect(matchedTerms({ title: "small modular reactors; zoning; co-location" })).toEqual(["co-location"]);
    expect(matchedTerms({ title: "Hyperscale data centers; water" })).toEqual(["data center", "hyperscale"]);
    expect(matchedTerms({ title: "taxation; omnibus; 2026-2027" })).toEqual([]);
  });
});

describe("billStatus", () => {
  it("prefers terminal outcomes", () => {
    expect(billStatus([act("2026-01-01", ["introduction"]), act("2026-03-01", ["executive-signature"])])).toBe("enacted");
    expect(billStatus([act("2026-01-01", ["passage"], "lower"), act("2026-03-01", ["executive-veto"])])).toBe("vetoed");
  });

  it("counts chambers passed, including unicameral Nebraska", () => {
    expect(billStatus([act("2026-01-01", ["passage"], "lower")])).toBe("passed_chamber");
    expect(
      billStatus([act("2026-01-01", ["passage"], "lower"), act("2026-02-01", ["passage"], "upper")])
    ).toBe("passed_legislature");
    expect(billStatus([act("2026-01-01", ["passage"], "legislature")])).toBe("passed_legislature");
  });

  it("walks the earlier stages", () => {
    expect(billStatus([act("2026-01-01", ["introduction", "referral-committee"])])).toBe("in_committee");
    expect(billStatus([act("2026-01-01", ["committee-passage-favorable"])])).toBe("passed_committee");
    expect(billStatus([act("2026-01-01", ["introduction"])])).toBe("introduced");
    expect(billStatus([])).toBe("introduced");
  });

  it("marks a bill failed only when the latest classified action is a failure", () => {
    expect(billStatus([act("2026-01-01", ["referral-committee"]), act("2026-02-01", ["committee-failure"])])).toBe("failed");
    expect(
      billStatus([act("2026-01-01", ["failure"], "lower"), act("2026-02-01", ["passage"], "lower")])
    ).toBe("passed_chamber");
  });

  it("sorts actions by date before reading them", () => {
    expect(billStatus([act("2026-02-01", ["withdrawal"]), act("2026-01-01", ["referral-committee"])])).toBe("failed");
  });
});

describe("toLegislationRow", () => {
  const bill = {
    id: "ocd-bill/123",
    session: "2026",
    identifier: "HB 2001",
    title: "Data center water reporting",
    openstates_url: "https://openstates.org/az/bills/2026/HB2001/",
    latest_action_date: "2026-03-04T00:00:00+00:00",
    latest_action_description: "Referred to committee",
    sponsorships: [
      { name: "Rep. A", primary: true },
      { name: "Rep. B", primary: false },
    ],
    abstracts: [{ abstract: "  Requires annual water use reports.  " }],
    sources: [{ url: "https://www.azleg.gov/bill/HB2001" }],
    actions: [act("2026-03-04", ["referral-committee"])],
  };

  it("prefers the official abstract and the legislature's own URL", () => {
    const row = toLegislationRow(bill, "AZ");
    expect(row).toMatchObject({
      openstates_id: "ocd-bill/123",
      state: "AZ",
      bill_number: "HB 2001",
      sponsor: "Rep. A",
      status: "in_committee",
      summary: "Requires annual water use reports.",
      summary_source: "abstract",
      source_url: "https://www.azleg.gov/bill/HB2001",
      last_action_date: "2026-03-04",
    });
  });

  it("falls back to the title, labeled as such, when there's no abstract", () => {
    const row = toLegislationRow({ ...bill, abstracts: [], sources: [] }, "AZ");
    expect(row.summary).toBe(bill.title);
    expect(row.summary_source).toBe("title");
    expect(row.source_url).toBe(bill.openstates_url);
  });
});

describe("parseGazetteer", () => {
  it("reads the padded tab-separated Census format and skips junk rows", () => {
    const text = [
      "GEOID\tALAND\tAWATER\tALAND_SQMI\tAWATER_SQMI\tINTPTLAT\tINTPTLONG                  ",
      "85226\t1\t2\t3\t4\t33.300000\t-111.950000           ",
      "XXXXX\t1\t2\t3\t4\t1\t2",
      "",
    ].join("\n");
    expect(parseGazetteer(text)).toEqual([{ zip: "85226", lat: 33.3, lon: -111.95 }]);
  });

  it("fails loudly if the header changes", () => {
    expect(() => parseGazetteer("ZIP\tLAT\tLON\n85226\t1\t2")).toThrow(/Unexpected Gazetteer header/);
  });
});

describe("parseZctaCounty", () => {
  const header =
    "OID_ZCTA5_20|GEOID_ZCTA5_20|NAMELSAD_ZCTA5_20|AREALAND_ZCTA5_20|AREAWATER_ZCTA5_20|MTFCC_ZCTA5_20|CLASSFP_ZCTA5_20|FUNCSTAT_ZCTA5_20|OID_COUNTY_20|GEOID_COUNTY_20|NAMELSAD_COUNTY_20|AREALAND_COUNTY_20|AREAWATER_COUNTY_20|MTFCC_COUNTY_20|CLASSFP_COUNTY_20|FUNCSTAT_COUNTY_20|AREALAND_PART|AREAWATER_PART";
  const row = (zip: string, county: string, land: number) => `|${zip}|||||||1|${county}|||||||${land}|0`;

  it("picks the county holding most of each ZIP's land and skips county-only rows", () => {
    const text = [`﻿${header}`, row("17101", "42041", 900), row("17101", "42043", 4000), row("", "01003", 5), ""].join("\n");
    expect(parseZctaCounty(text)).toEqual(new Map([["17101", "42043"]]));
  });

  it("fails loudly if the header changes", () => {
    expect(() => parseZctaCounty("ZIP|COUNTY\n85226|04013")).toThrow(/Unexpected relationship file header/);
  });
});
