import { describe, expect, it } from "vitest";
import COEFFICIENTS from "@/lib/simulator/coefficients.json";
import EGRID from "@/lib/simulator/data/egrid2023-subregions.json";
import {
  COOLING_TYPES,
  HOURS_PER_YEAR,
  LBS_PER_METRIC_TON,
  LITERS_PER_GALLON,
  gridCarbonMultiplier,
  mixWaterGalPerMWh,
  resolveRegion,
  simulate,
  type SimulatorInputs,
} from "@/lib/simulator/model";

const base: SimulatorInputs = {
  itLoadMW: 100,
  cooling: "evaporative",
  powerSource: "grid",
  buildYear: 2023, // before futureBuildUncertainty.fromYear and the AEO base year
  subregionCode: null,
  residentialCustomers: 1_000_000,
};

const zeroMix = {
  coal: 0, oil: 0, gas: 0, nuclear: 0, hydro: 0, biomass: 0,
  wind: 0, solar: 0, geothermal: 0, otherFossil: 0, unknown: 0,
};

describe("simulate: core formula", () => {
  it("computes annual MWh = IT x PUE x 8760 x utilization, pairing lows and highs", () => {
    const r = simulate(base);
    const c = COEFFICIENTS.cooling.evaporative;
    const u = COEFFICIENTS.utilization;
    expect(r.annualMWh.low).toBeCloseTo(100 * c.pue.low * HOURS_PER_YEAR * u.low, 6);
    expect(r.annualMWh.high).toBeCloseTo(100 * c.pue.high * HOURS_PER_YEAR * u.high, 6);
  });

  it("computes onsite water = IT-only kWh x site WUE (WUE's denominator is IT energy)", () => {
    const r = simulate(base);
    expect(r.onsiteWaterL.low).toBeCloseTo(r.itOnlyMWh.low * 1000 * r.wue.low, 3);
    expect(r.onsiteWaterL.high).toBeCloseTo(r.itOnlyMWh.high * 1000 * r.wue.high, 3);
  });

  it("splits annual electricity into the computers' share plus overhead", () => {
    const r = simulate(base);
    expect(r.itOnlyMWh.high + r.overheadMWh.high).toBeCloseTo(r.annualMWh.high, 6);
    expect(r.itOnlyMWh.low + r.overheadMWh.low).toBeCloseTo(r.annualMWh.low, 6);
  });

  it("converts to everyday equivalents using the cited figures", () => {
    const r = simulate(base);
    expect(r.electricityHomes.high).toBeCloseTo(
      (r.annualMWh.high * 1000) / COEFFICIENTS.householdElectricity.kWhPerYear,
      6
    );
    expect(r.emissionsCars.high).toBeCloseTo(
      r.emissionsT.high / COEFFICIENTS.passengerVehicle.tCo2PerYear,
      6
    );
  });

  it("computes emissions = annual MWh x carbon rate, in metric tons", () => {
    const r = simulate(base);
    const rate = EGRID.usAverage.co2eLbPerMWh;
    expect(r.emissionsT.high).toBeCloseTo((r.annualMWh.high * rate) / LBS_PER_METRIC_TON, 3);
  });

  it("computes generation water from the region's mix", () => {
    const r = simulate(base);
    const w = mixWaterGalPerMWh(EGRID.usAverage.mix);
    expect(r.generationWaterL.low).toBeCloseTo(r.annualMWh.low * w.low * LITERS_PER_GALLON, 3);
  });

  it("scales linearly with IT load and treats negative load as zero", () => {
    const one = simulate({ ...base, itLoadMW: 1 });
    const ten = simulate({ ...base, itLoadMW: 10 });
    expect(ten.annualMWh.high).toBeCloseTo(one.annualMWh.high * 10, 6);
    expect(simulate({ ...base, itLoadMW: -5 }).annualMWh.high).toBe(0);
  });

  it("always returns low <= high", () => {
    for (const cooling of COOLING_TYPES) {
      for (const powerSource of ["grid", "onsite_gas", "dedicated_renewables"] as const) {
        const r = simulate({ ...base, cooling, powerSource, buildYear: 2030, subregionCode: "AZNM" });
        for (const key of ["annualMWh", "onsiteWaterL", "generationWaterL", "emissionsT"] as const) {
          expect(r[key].low).toBeLessThanOrEqual(r[key].high);
        }
      }
    }
  });
});

describe("simulate: the tradeoff the simulator exists to teach", () => {
  it("evaporative uses far more onsite water than air or closed-loop", () => {
    const evap = simulate(base);
    const air = simulate({ ...base, cooling: "air" });
    const closed = simulate({ ...base, cooling: "closed_loop" });
    expect(air.onsiteWaterL.high).toBeLessThan(evap.onsiteWaterL.low);
    expect(closed.onsiteWaterL.high).toBeLessThan(evap.onsiteWaterL.low);
  });

  it("air cooling draws more electricity at the high end than evaporative", () => {
    expect(simulate({ ...base, cooling: "air" }).annualMWh.high).toBeGreaterThan(
      simulate(base).annualMWh.high
    );
  });
});

describe("build year", () => {
  it("widens PUE overhead and WUE by the LBNL spread from 2024 on", () => {
    const before = simulate({ ...base, buildYear: 2023 });
    const after = simulate({ ...base, buildYear: 2024 });
    const s = COEFFICIENTS.futureBuildUncertainty.spread;
    expect(before.futureUncertaintyApplied).toBe(false);
    expect(after.futureUncertaintyApplied).toBe(true);
    expect(after.pue.high - 1).toBeCloseTo((before.pue.high - 1) * (1 + s), 9);
    expect(after.pue.low - 1).toBeCloseTo((before.pue.low - 1) * (1 - s), 9);
    expect(after.wue.high).toBeCloseTo(before.wue.high * (1 + s), 9);
  });

  it("applies no grid carbon change at or before the AEO base year", () => {
    expect(gridCarbonMultiplier(2020)).toEqual({ low: 1, high: 1 });
    expect(gridCarbonMultiplier(2025)).toEqual({ low: 1, high: 1 });
  });

  it("uses the AEO intensity ratio as the low end and no decline as the high end", () => {
    const s = COEFFICIENTS.gridCarbonTrajectory.series;
    const expected = s["2030"].co2Mt / s["2030"].genBkWh / (s["2025"].co2Mt / s["2025"].genBkWh);
    const m = gridCarbonMultiplier(2030);
    expect(m.low).toBeCloseTo(expected, 9);
    expect(m.high).toBe(1);
  });

  it("clamps years past the published series to its last year", () => {
    expect(gridCarbonMultiplier(2040)).toEqual(gridCarbonMultiplier(2035));
  });
});

describe("regions and power sources", () => {
  it("falls back to the U.S. average for null or unknown subregions", () => {
    expect(resolveRegion(null).isUsAverage).toBe(true);
    expect(resolveRegion("NOPE").isUsAverage).toBe(true);
    expect(resolveRegion("AZNM").isUsAverage).toBe(false);
  });

  it("uses the subregion's own rate when one is given", () => {
    const r = simulate({ ...base, subregionCode: "NYUP" });
    expect(r.region.code).toBe("NYUP");
    expect(r.carbonLbPerMWh.high).toBe(EGRID.subregions.NYUP.co2eLbPerMWh);
  });

  it("prices a pure-gas mix at the gas factors", () => {
    const f = COEFFICIENTS.generationWaterGalPerMWh.fuels.gas;
    expect(mixWaterGalPerMWh({ ...zeroMix, gas: 1 })).toEqual({ low: f.low, high: f.high });
  });

  it("excludes hydropower reservoir evaporation", () => {
    expect(mixWaterGalPerMWh({ ...zeroMix, hydro: 1 })).toEqual({ low: 0, high: 0 });
  });

  it("ranges a renewables contract from zero up to the local grid", () => {
    const grid = simulate({ ...base, subregionCode: "RFCW" });
    const ppa = simulate({ ...base, subregionCode: "RFCW", powerSource: "dedicated_renewables" });
    expect(ppa.emissionsT.low).toBe(0);
    expect(ppa.emissionsT.high).toBeCloseTo(grid.emissionsT.high, 6);
  });

  it("ignores the region's grid for an on-site gas plant", () => {
    const a = simulate({ ...base, powerSource: "onsite_gas", subregionCode: "NYUP" });
    const b = simulate({ ...base, powerSource: "onsite_gas", subregionCode: "SRMW" });
    expect(a.emissionsT).toEqual(b.emissionsT);
  });
});

describe("cost allocation", () => {
  it("prices peak demand (IT x PUE) at the capacity benchmark for a full year", () => {
    const r = simulate(base);
    const p = COEFFICIENTS.costAllocation.capacityPriceUsdPerMWDay;
    expect(r.cost.annualCapacityCostUsd.low).toBeCloseTo(r.peakDemandMW.low * p.low * 365, 3);
    expect(r.cost.annualCapacityCostUsd.high).toBeCloseTo(r.peakDemandMW.high * p.high * 365, 3);
  });

  it("spreads the residential share across residential customers when socialized", () => {
    const r = simulate({ ...base, residentialCustomers: 500_000 });
    const share = COEFFICIENTS.costAllocation.residentialShareOfSales.value;
    expect(r.cost.socializedPerHouseholdUsd.high).toBeCloseTo(
      (r.cost.annualCapacityCostUsd.high * share) / 500_000,
      6
    );
  });
});

describe("coefficients file integrity", () => {
  const sources = COEFFICIENTS.sources as Record<string, unknown>;

  it("cites a known source for every cooling type, and every range is ordered", () => {
    for (const c of Object.values(COEFFICIENTS.cooling)) {
      expect(sources[c.sourceId]).toBeDefined();
      expect(c.pue.low).toBeLessThanOrEqual(c.pue.high);
      expect(c.wueSiteLPerKWh.low).toBeLessThanOrEqual(c.wueSiteLPerKWh.high);
      expect(c.pue.low).toBeGreaterThanOrEqual(1);
    }
    for (const f of Object.values(COEFFICIENTS.generationWaterGalPerMWh.fuels)) {
      expect(f.low).toBeLessThanOrEqual(f.high);
    }
  });

  it("keeps every drafted value flagged unverified until reviewed", () => {
    // Flip this test deliberately when the owner signs off on the numbers.
    const flagged = [
      COEFFICIENTS.utilization,
      ...Object.values(COEFFICIENTS.cooling),
      COEFFICIENTS.futureBuildUncertainty,
      COEFFICIENTS.gridCarbonTrajectory,
      COEFFICIENTS.generationWaterGalPerMWh,
      COEFFICIENTS.costAllocation,
    ];
    for (const v of flagged) expect(v.verified).toBe(false);
  });

  it("gives every cooling type a share entry, and each column sums to ~100%", () => {
    const shares = COEFFICIENTS.coolingShares.byCooling as Record<
      string,
      { hyperscalePct: number | null; aiPct: number | null }
    >;
    expect(Object.keys(shares).sort()).toEqual([...COOLING_TYPES].sort());
    const sum = (k: "hyperscalePct" | "aiPct") =>
      Object.values(shares).reduce((acc, s) => acc + (s[k] ?? 0), 0);
    expect(sum("hyperscalePct")).toBeGreaterThanOrEqual(97);
    expect(sum("hyperscalePct")).toBeLessThanOrEqual(103);
    expect(sum("aiPct")).toBeGreaterThanOrEqual(97);
    expect(sum("aiPct")).toBeLessThanOrEqual(103);
  });

  it("has an AEO series row for the base year", () => {
    const years = Object.keys(COEFFICIENTS.gridCarbonTrajectory.series);
    expect(years).toContain(String(COEFFICIENTS.gridCarbonTrajectory.baseYear));
  });
});
