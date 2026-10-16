import { describe, expect, it } from "vitest";
import { describeMix, droughtPlain, homesPerMegawatt, waterStressBand } from "@/lib/simulator/plainEnglish";

describe("describeMix", () => {
  it("names the biggest sources in plain words, largest first", () => {
    expect(describeMix({ gas: 0.487, nuclear: 0.18, coal: 0.111, wind: 0.077 })).toBe(
      "natural gas (49%), nuclear (18%), and coal (11%)"
    );
  });

  it("drops sources under 5% and handles one or two sources", () => {
    expect(describeMix({ hydro: 0.9, solar: 0.04 })).toBe("hydropower (dams) (90%)");
    expect(describeMix({ gas: 0.6, wind: 0.4 })).toBe("natural gas (60%) and wind (40%)");
  });
});

describe("waterStressBand", () => {
  it("maps WRI's 0-5 score to its five bands", () => {
    expect(waterStressBand(0.4).label).toBe("Low");
    expect(waterStressBand(2.5).label).toBe("Medium to high");
    expect(waterStressBand(4.9).level).toBe(4);
    expect(waterStressBand(5).level).toBe(4);
  });

  it("distinguishes WRI's arid category from a missing score", () => {
    expect(waterStressBand(null, "Arid and Low Water Use").label).toBe("Dry, little water use");
    expect(waterStressBand(null, null).label).toBe("Not rated");
  });
});

describe("droughtPlain", () => {
  it("explains Drought Monitor categories and passes through unknown ones", () => {
    expect(droughtPlain("D2")?.label).toBe("Severe drought");
    expect(droughtPlain(null)).toBeNull();
    expect(droughtPlain("D9")?.label).toBe("D9");
  });
});

describe("homesPerMegawatt", () => {
  it("is a year of 1 MW divided by the average home's annual use", () => {
    expect(homesPerMegawatt()).toBeCloseTo(8_760_000 / 10_791, 6);
  });
});
