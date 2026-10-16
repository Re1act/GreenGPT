import COEFFICIENTS from "@/lib/simulator/coefficients.json";
import {
  COOLING_TYPES,
  MAX_BUILD_YEAR,
  MIN_BUILD_YEAR,
  POWER_SOURCES,
  type CoolingType,
  type SimulatorInputs,
} from "@/lib/simulator/model";

// The simulator's URL contract, shared by the /simulate page (parse) and the
// map's facility popup (build). A facility link carries only what that facility
// record actually discloses; everything else falls back to defaults, and the
// page says which inputs came from the facility.

export type LatLon = { lat: number; lon: number };
export type ScenarioInputs = Omit<SimulatorInputs, "subregionCode">;

export type InitialScenario = {
  inputs: ScenarioInputs;
  point: LatLon | null;
  facilityName: string | null;
  /** Which inputs were preloaded from the facility link rather than defaulted. */
  fromFacility: { load: boolean; cooling: boolean; buildYear: boolean };
};

export const MIN_IT_LOAD_MW = 1;
export const MAX_IT_LOAD_MW = 2000;

export const DEFAULT_INPUTS: ScenarioInputs = {
  itLoadMW: 100,
  cooling: "evaporative",
  powerSource: "grid",
  buildYear: 2026,
  residentialCustomers: COEFFICIENTS.costAllocation.defaultResidentialCustomers.value,
};

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function num(value: string | undefined): number | null {
  if (value === undefined || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function parseScenarioParams(raw: RawParams): InitialScenario {
  const lat = num(first(raw.lat));
  const lon = num(first(raw.lon));
  const point =
    lat !== null && lon !== null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon } : null;

  const mw = num(first(raw.mw));
  const coolingRaw = first(raw.cooling);
  const cooling = COOLING_TYPES.find((c) => c === coolingRaw);
  const powerRaw = first(raw.power);
  const power = POWER_SOURCES.find((p) => p === powerRaw);
  const year = num(first(raw.year));

  const name = first(raw.name)?.trim().slice(0, 200) || null;

  return {
    inputs: {
      ...DEFAULT_INPUTS,
      itLoadMW: mw !== null && mw > 0 ? clamp(mw, MIN_IT_LOAD_MW, MAX_IT_LOAD_MW) : DEFAULT_INPUTS.itLoadMW,
      cooling: cooling ?? DEFAULT_INPUTS.cooling,
      powerSource: power ?? DEFAULT_INPUTS.powerSource,
      buildYear:
        year !== null ? clamp(Math.round(year), MIN_BUILD_YEAR, MAX_BUILD_YEAR) : DEFAULT_INPUTS.buildYear,
    },
    point,
    facilityName: name,
    fromFacility: { load: mw !== null && mw > 0, cooling: cooling !== undefined, buildYear: year !== null },
  };
}

export function facilityScenarioHref(f: {
  name: string;
  lat: number;
  lon: number;
  announcedLoadMW: number | null;
  coolingType: string | null;
  buildYear: number | null;
}): string {
  const params = new URLSearchParams({
    name: f.name,
    lat: f.lat.toFixed(4),
    lon: f.lon.toFixed(4),
  });
  if (f.announcedLoadMW) params.set("mw", String(f.announcedLoadMW));
  if (f.coolingType && COOLING_TYPES.includes(f.coolingType as CoolingType)) {
    params.set("cooling", f.coolingType);
  }
  if (f.buildYear) params.set("year", String(f.buildYear));
  return `/simulate?${params.toString()}`;
}
