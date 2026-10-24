import { describe, expect, it } from "vitest";
import { parsePeopleGeo, parseSenateXml } from "@/lib/brief/officials";

const SENATE_XML = `<?xml version="1.0" encoding="UTF-8"?><contact_information><member>
  <member_full>Kelly (D-AZ)</member_full>
  <last_name>Kelly</last_name>
  <first_name>Mark</first_name>
  <party>D</party>
  <state>AZ</state>
  <phone>(202) 224-2235</phone>
  <website>https://www.kelly.senate.gov/</website>
</member><member>
  <last_name>Baldwin</last_name>
  <first_name>Tammy</first_name>
  <party>D</party>
  <state>WI</state>
  <phone>(202) 224-5653</phone>
  <website>https://www.baldwin.senate.gov/</website>
</member></contact_information>`;

describe("parseSenateXml", () => {
  it("returns only the requested state's senators", () => {
    expect(parseSenateXml(SENATE_XML, "AZ")).toEqual([
      {
        name: "Mark Kelly",
        role: "U.S. Senator (Democratic)",
        approximate: false,
        phone: "(202) 224-2235",
        url: "https://www.kelly.senate.gov/",
      },
    ]);
    expect(parseSenateXml(SENATE_XML, "TX")).toEqual([]);
  });
});

describe("parsePeopleGeo", () => {
  const json = {
    results: [
      {
        name: "State Rep",
        party: "Republican",
        current_role: { title: "Representative", org_classification: "lower", district: "13" },
        jurisdiction: { classification: "state" },
        offices: [{ voice: null }, { voice: "602-555-0100" }],
        links: [{ url: "https://www.azleg.gov/rep" }],
      },
      {
        name: "State Sen",
        party: "Democratic",
        current_role: { title: "Senator", org_classification: "upper", district: 13 },
        jurisdiction: { classification: "state" },
        openstates_url: "https://openstates.org/person/sen",
      },
      {
        name: "House Member",
        party: "Democratic",
        current_role: { title: "Representative", org_classification: "lower", district: "AZ-4" },
        jurisdiction: { classification: "country" },
      },
      {
        name: "U.S. Senator Dup",
        current_role: { org_classification: "upper" },
        jurisdiction: { classification: "country" },
      },
      { party: "Nameless" },
    ],
  };

  it("labels chambers, skips federal senators (senate.gov covers them), and orders House first", () => {
    const officials = parsePeopleGeo(json, "AZ");
    expect(officials.map((o) => o.role)).toEqual([
      "U.S. Representative, District 4 (Democratic)",
      "State Senator, District 13 (Democratic)",
      "State Representative, District 13 (Republican)",
    ]);
    expect(officials.every((o) => o.approximate)).toBe(true);
  });

  it("uses the first phone and link it finds, falling back to Open States", () => {
    const officials = parsePeopleGeo(json, "AZ");
    const rep = officials.find((o) => o.name === "State Rep")!;
    expect(rep.phone).toBe("602-555-0100");
    expect(rep.url).toBe("https://www.azleg.gov/rep");
    expect(officials.find((o) => o.name === "State Sen")!.url).toBe("https://openstates.org/person/sen");
  });

  it("labels at-large House seats", () => {
    const [o] = parsePeopleGeo({
      results: [{ name: "AK", current_role: { org_classification: "lower", district: "AK-AL" }, jurisdiction: { classification: "country" } }],
    }, "AK");
    expect(o.role).toBe("U.S. Representative, at-large");
  });

  it("treats Nebraska's unicameral members as state senators", () => {
    const [o] = parsePeopleGeo({
      results: [{ name: "NE", current_role: { org_classification: "legislature", district: "5" }, jurisdiction: { classification: "state" } }],
    }, "NE");
    expect(o.role).toBe("State Senator, District 5");
  });

  it("keeps named districts readable", () => {
    const [o] = parsePeopleGeo({
      results: [{ name: "VT", current_role: { org_classification: "lower", district: "Washington-5" }, jurisdiction: { classification: "state" } }],
    }, "VT");
    expect(o.role).toBe("State Representative, Washington-5 district");
  });

  it("uses DC's and Puerto Rico's own titles", () => {
    const dc = parsePeopleGeo({
      results: [
        { name: "Council", current_role: { org_classification: "legislature", district: "Ward 2" }, jurisdiction: { classification: "state" } },
        { name: "Delegate", current_role: { org_classification: "lower", district: "DC-AL" }, jurisdiction: { classification: "country" } },
      ],
    }, "DC");
    expect(dc.map((o) => o.role)).toEqual(["Delegate to the U.S. House (non-voting), at-large", "DC Council member, Ward 2"]);
    expect(dc.map((o) => o.approximate)).toEqual([false, true]);
    const [pr] = parsePeopleGeo({
      results: [{ name: "PR", current_role: { org_classification: "upper", district: "1" }, jurisdiction: { classification: "state" } }],
    }, "PR");
    expect(pr.role).toBe("Puerto Rico Senator, District 1");
  });

  it("tolerates an empty or malformed response", () => {
    expect(parsePeopleGeo(null, "AZ")).toEqual([]);
    expect(parsePeopleGeo({}, "AZ")).toEqual([]);
  });
});
