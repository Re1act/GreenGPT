import COEFFICIENTS from "@/lib/simulator/coefficients.json";
import EGRID from "@/lib/simulator/data/egrid2023-subregions.json";

// The simulator's whole numeric model: pure functions over the versioned
// coefficients file and the generated eGRID table, no I/O. The brief's core
// calculation, extended to ranges:
//
//   annual_MWh       = IT_load_MW x PUE x 8760 x utilization
//   onsite_water_L   = IT_kWh x WUE_L_per_kWh   (brief wrote annual_kWh; see below)
//   offsite_water_L  = annual_kWh x grid_water_intensity(region)
//   emissions_t      = annual_MWh x eGRID_subregion_intensity
//
// Every output is a { low, high } range. Low pairs every input's low end, high
// pairs every high end, so the bounds are deliberately the widest defensible
// envelope -- a real facility sits somewhere inside, and the UI says so rather
// than presenting a midpoint as an estimate.

export type Range = { low: number; high: number };

export type CoolingType = keyof typeof COEFFICIENTS.cooling;
export type PowerSource = keyof typeof COEFFICIENTS.powerSources;
type Fuel = keyof typeof COEFFICIENTS.generationWaterGalPerMWh.fuels;
type GridRegion = { name: string; co2eLbPerMWh: number; mix: Record<Fuel, number> };

export const COOLING_TYPES = Object.keys(COEFFICIENTS.cooling) as CoolingType[];
export const POWER_SOURCES = Object.keys(COEFFICIENTS.powerSources) as PowerSource[];

export const HOURS_PER_YEAR = 8760;
export const LITERS_PER_GALLON = 3.785411784;
export const LBS_PER_METRIC_TON = 2204.62262;

const SUBREGIONS = EGRID.subregions as Record<string, GridRegion>;
const TRAJECTORY = COEFFICIENTS.gridCarbonTrajectory;
const TRAJECTORY_YEARS = Object.keys(TRAJECTORY.series).map(Number);
export const MIN_BUILD_YEAR = 2020;
export const MAX_BUILD_YEAR = Math.max(...TRAJECTORY_YEARS);

export type SimulatorInputs = {
  itLoadMW: number;
  cooling: CoolingType;
  powerSource: PowerSource;
  buildYear: number;
  /** eGRID subregion acronym; null (or unknown) falls back to the U.S. average. */
  subregionCode: string | null;
  residentialCustomers: number;
};

export type SimulatorResult = {
  region: { code: string | null; name: string; co2eLbPerMWh: number; isUsAverage: boolean };
  utilization: Range;
  pue: Range;
  wue: Range;
  futureUncertaintyApplied: boolean;
  gridCarbonMultiplier: Range;
  annualMWh: Range;
  /** The servers' own share of annualMWh (PUE = 1). */
  itOnlyMWh: Range;
  /** Cooling and other facility overhead: annualMWh minus the servers' share. */
  overheadMWh: Range;
  /** Power-source carbon intensity actually applied (lb CO2e/MWh). */
  carbonLbPerMWh: Range;
  /** Power-source water intensity actually applied (gal/MWh). */
  generationWaterGalPerMWh: Range;
  onsiteWaterL: Range;
  generationWaterL: Range;
  emissionsT: Range;
  peakDemandMW: Range;
  // Everyday equivalents for the plain-English walkthrough (sources in
  // coefficients.json: householdWater, householdElectricity, passengerVehicle).
  onsiteWaterHouseholds: Range;
  generationWaterHouseholds: Range;
  electricityHomes: Range;
  overheadHomes: Range;
  emissionsCars: Range;
  cost: {
    annualCapacityCostUsd: Range;
    residentialShare: number;
    /** Per-household annual cost if the capacity cost is spread across all ratepayers. */
    socializedPerHouseholdUsd: Range;
  };
};

const range = (low: number, high: number): Range => ({ low, high });
const scale = (r: Range, k: number): Range => range(r.low * k, r.high * k);
const mul = (a: Range, b: Range): Range => range(a.low * b.low, a.high * b.high);

export function galToLiters(gal: number) {
  return gal * LITERS_PER_GALLON;
}

export function resolveRegion(code: string | null) {
  const sub = code ? SUBREGIONS[code] : undefined;
  if (sub) return { code, region: sub, isUsAverage: false };
  return { code: null, region: EGRID.usAverage as GridRegion, isUsAverage: true };
}

/** Generation water intensity of a resource mix, gal/MWh (Macknick consumption factors). */
export function mixWaterGalPerMWh(mix: Record<Fuel, number>): Range {
  const factors = COEFFICIENTS.generationWaterGalPerMWh.fuels;
  let low = 0;
  let high = 0;
  for (const fuel of Object.keys(factors) as Fuel[]) {
    const share = mix[fuel] ?? 0;
    low += share * factors[fuel].low;
    high += share * factors[fuel].high;
  }
  return range(low, high);
}

function aeoIntensity(year: number) {
  const row = TRAJECTORY.series[String(year) as keyof typeof TRAJECTORY.series];
  return row.co2Mt / row.genBkWh;
}

/**
 * Multiplier on the eGRID2023 carbon rate for a facility first operating in
 * `buildYear`. Low = AEO2026 baseline decline relative to its base year; high =
 * no decline. Years before the AEO base use the eGRID rate as-is; years past
 * the published series clamp to its last year.
 */
export function gridCarbonMultiplier(buildYear: number): Range {
  if (buildYear <= TRAJECTORY.baseYear) return range(1, 1);
  const year = Math.min(buildYear, MAX_BUILD_YEAR);
  return range(aeoIntensity(year) / aeoIntensity(TRAJECTORY.baseYear), 1);
}

export function simulate(inputs: SimulatorInputs): SimulatorResult {
  const itLoadMW = Math.max(0, inputs.itLoadMW);
  const { code, region, isUsAverage } = resolveRegion(inputs.subregionCode);
  const cooling = COEFFICIENTS.cooling[inputs.cooling];

  const utilization = range(COEFFICIENTS.utilization.low, COEFFICIENTS.utilization.high);

  // Future builds widen the cooling ranges rather than assuming an efficiency
  // trend -- see futureBuildUncertainty in coefficients.json for why.
  const future = COEFFICIENTS.futureBuildUncertainty;
  const futureUncertaintyApplied = inputs.buildYear >= future.fromYear;
  const spread = futureUncertaintyApplied ? future.spread : 0;
  const pue = range(
    1 + (cooling.pue.low - 1) * (1 - spread),
    1 + (cooling.pue.high - 1) * (1 + spread)
  );
  const wue = range(
    cooling.wueSiteLPerKWh.low * (1 - spread),
    cooling.wueSiteLPerKWh.high * (1 + spread)
  );

  const annualMWh = scale(mul(pue, utilization), itLoadMW * HOURS_PER_YEAR);
  const annualKWh = scale(annualMWh, 1000);
  const itOnlyMWh = scale(utilization, itLoadMW * HOURS_PER_YEAR);
  const overheadMWh = scale(
    mul(range(pue.low - 1, pue.high - 1), utilization),
    itLoadMW * HOURS_PER_YEAR
  );

  const multiplier = gridCarbonMultiplier(inputs.buildYear);
  const gridCarbon = scale(multiplier, region.co2eLbPerMWh);
  const gridWater = mixWaterGalPerMWh(region.mix);

  let carbonLbPerMWh: Range;
  let generationWaterGalPerMWh: Range;
  switch (inputs.powerSource) {
    case "onsite_gas": {
      const gas = COEFFICIENTS.powerSources.onsite_gas;
      carbonLbPerMWh = range(gas.co2LbPerMWh.low, gas.co2LbPerMWh.high);
      generationWaterGalPerMWh = range(gas.waterGalPerMWh.low, gas.waterGalPerMWh.high);
      break;
    }
    case "dedicated_renewables": {
      // Low: the contracted wind/solar itself. High: the grid it physically
      // runs on whenever the contract's generation isn't there.
      const solarMax = COEFFICIENTS.generationWaterGalPerMWh.fuels.solar.high;
      carbonLbPerMWh = range(0, gridCarbon.high);
      generationWaterGalPerMWh = range(0, Math.max(solarMax, gridWater.high));
      break;
    }
    default:
      carbonLbPerMWh = gridCarbon;
      generationWaterGalPerMWh = gridWater;
  }

  // WUE is defined against the computers' energy, not the whole building's
  // (The Green Grid's industry-standard definition), so it multiplies
  // IT-only kWh. The brief's formula wrote annual_kWh here; using the facility
  // total would overstate onsite water by the PUE factor.
  const onsiteWaterL = mul(scale(itOnlyMWh, 1000), wue);
  const generationWaterL = mul(
    annualKWh,
    scale(generationWaterGalPerMWh, LITERS_PER_GALLON / 1000)
  );
  const emissionsT = scale(mul(annualMWh, carbonLbPerMWh), 1 / LBS_PER_METRIC_TON);

  const householdGalPerYear = COEFFICIENTS.householdWater.galPerDay * 365;
  const perHousehold = 1 / LITERS_PER_GALLON / householdGalPerYear;
  const onsiteWaterHouseholds = scale(onsiteWaterL, perHousehold);
  const generationWaterHouseholds = scale(generationWaterL, perHousehold);
  const homeMWhPerYear = COEFFICIENTS.householdElectricity.kWhPerYear / 1000;
  const electricityHomes = scale(annualMWh, 1 / homeMWhPerYear);
  const overheadHomes = scale(overheadMWh, 1 / homeMWhPerYear);
  const emissionsCars = scale(emissionsT, 1 / COEFFICIENTS.passengerVehicle.tCo2PerYear);

  // Cost allocation: peak facility draw (IT at full capacity x PUE) priced at
  // the capacity benchmark. Illustrative only -- see costAllocation notes.
  const ca = COEFFICIENTS.costAllocation;
  const peakDemandMW = scale(pue, itLoadMW);
  const annualCapacityCostUsd = mul(
    peakDemandMW,
    range(ca.capacityPriceUsdPerMWDay.low * 365, ca.capacityPriceUsdPerMWDay.high * 365)
  );
  const residentialShare = ca.residentialShareOfSales.value;
  const customers = Math.max(1, inputs.residentialCustomers);
  const socializedPerHouseholdUsd = scale(annualCapacityCostUsd, residentialShare / customers);

  return {
    region: { code, name: region.name, co2eLbPerMWh: region.co2eLbPerMWh, isUsAverage },
    utilization,
    pue,
    wue,
    futureUncertaintyApplied,
    gridCarbonMultiplier: multiplier,
    annualMWh,
    itOnlyMWh,
    overheadMWh,
    carbonLbPerMWh,
    generationWaterGalPerMWh,
    onsiteWaterL,
    generationWaterL,
    emissionsT,
    peakDemandMW,
    onsiteWaterHouseholds,
    generationWaterHouseholds,
    electricityHomes,
    overheadHomes,
    emissionsCars,
    cost: { annualCapacityCostUsd, residentialShare, socializedPerHouseholdUsd },
  };
}
