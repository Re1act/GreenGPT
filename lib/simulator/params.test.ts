import { describe, expect, it } from "vitest";
import { MAX_BUILD_YEAR } from "@/lib/simulator/model";
import {
  DEFAULT_INPUTS,
  MAX_IT_LOAD_MW,
  facilityScenarioHref,
  parseScenarioParams,
} from "@/lib/simulator/params";

describe("parseScenarioParams", () => {
  it("returns defaults and no point for an empty query", () => {
    const s = parseScenarioParams({});
    expect(s.inputs).toEqual(DEFAULT_INPUTS);
    expect(s.point).toBeNull();
    expect(s.facilityName).toBeNull();
    expect(s.fromFacility).toEqual({ load: false, cooling: false, buildYear: false });
  });

  it("reads a full facility link", () => {
    const s = parseScenarioParams({
      name: "Project Blue",
      lat: "32.121",
      lon: "-110.752",
      mw: "300",
      cooling: "closed_loop",
      year: "2027",
    });
    expect(s.point).toEqual({ lat: 32.121, lon: -110.752 });
    expect(s.inputs.itLoadMW).toBe(300);
    expect(s.inputs.cooling).toBe("closed_loop");
    expect(s.inputs.buildYear).toBe(2027);
    expect(s.fromFacility).toEqual({ load: true, cooling: true, buildYear: true });
  });

  it("rejects unknown enums, junk numbers, and out-of-range coordinates", () => {
    const s = parseScenarioParams({ cooling: "magic", power: "fusion", mw: "abc", lat: "95", lon: "0" });
    expect(s.inputs.cooling).toBe(DEFAULT_INPUTS.cooling);
    expect(s.inputs.powerSource).toBe(DEFAULT_INPUTS.powerSource);
    expect(s.inputs.itLoadMW).toBe(DEFAULT_INPUTS.itLoadMW);
    expect(s.point).toBeNull();
  });

  it("clamps load and build year", () => {
    const s = parseScenarioParams({ mw: "999999", year: "2099" });
    expect(s.inputs.itLoadMW).toBe(MAX_IT_LOAD_MW);
    expect(s.inputs.buildYear).toBe(MAX_BUILD_YEAR);
  });

  it("takes the first value of a repeated param", () => {
    expect(parseScenarioParams({ mw: ["50", "70"] }).inputs.itLoadMW).toBe(50);
  });
});

describe("facilityScenarioHref", () => {
  it("round-trips through parseScenarioParams", () => {
    const href = facilityScenarioHref({
      name: "Test & Co <site>",
      lat: 39.04,
      lon: -77.49,
      announcedLoadMW: 120,
      coolingType: "evaporative",
      buildYear: 2025,
    });
    const query = Object.fromEntries(new URL(href, "http://x").searchParams);
    const s = parseScenarioParams(query);
    expect(s.facilityName).toBe("Test & Co <site>");
    expect(s.point).toEqual({ lat: 39.04, lon: -77.49 });
    expect(s.inputs.itLoadMW).toBe(120);
    expect(s.inputs.cooling).toBe("evaporative");
    expect(s.inputs.buildYear).toBe(2025);
  });

  it("omits undisclosed fields instead of guessing them", () => {
    const href = facilityScenarioHref({
      name: "Undisclosed",
      lat: 33,
      lon: -112,
      announcedLoadMW: null,
      coolingType: null,
      buildYear: null,
    });
    const params = new URL(href, "http://x").searchParams;
    expect(params.has("mw")).toBe(false);
    expect(params.has("cooling")).toBe(false);
    expect(params.has("year")).toBe(false);
  });
});
