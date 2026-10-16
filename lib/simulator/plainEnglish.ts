import COEFFICIENTS from "@/lib/simulator/coefficients.json";
import EGRID from "@/lib/simulator/data/egrid2023-subregions.json";
import { HOURS_PER_YEAR } from "@/lib/simulator/model";

// Turns the region lookup and the eGRID mix into sentences a non-specialist can
// read. Kept separate from the components so the wording is testable and lives
// in one place.

const FUEL_NAMES: Record<string, string> = {
  coal: "coal",
  oil: "oil",
  gas: "natural gas",
  nuclear: "nuclear",
  hydro: "hydropower (dams)",
  biomass: "burning wood and plant waste",
  wind: "wind",
  solar: "solar",
  geothermal: "geothermal (underground heat)",
  otherFossil: "other fossil fuels",
  unknown: "unknown sources",
};

type Mix = Record<string, number>;

/** The biggest sources in a generation mix, e.g. "natural gas (49%), nuclear (18%), and coal (11%)". */
export function describeMix(mix: Mix, max = 3, minShare = 0.05): string {
  const top = Object.entries(mix)
    .filter(([, share]) => share >= minShare)
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([fuel, share]) => `${FUEL_NAMES[fuel] ?? fuel} (${Math.round(share * 100)}%)`);
  if (top.length === 0) return "a mix of many sources";
  if (top.length === 1) return top[0];
  return `${top.slice(0, -1).join(", ")}${top.length > 2 ? "," : ""} and ${top[top.length - 1]}`;
}

export function mixForSubregion(code: string | null): Mix {
  const subregions = EGRID.subregions as Record<string, { mix: Mix }>;
  return (code && subregions[code]?.mix) || EGRID.usAverage.mix;
}

export type WaterStressBand = {
  level: 0 | 1 | 2 | 3 | 4 | null;
  label: string;
  plain: string;
};

// WRI Aqueduct bands: baseline water stress is the share of the available water
// that people, farms, and industry already take out in a typical year. The
// score is WRI's 0-5 scale, one step per band (same steps as the map legend).
const BANDS: Omit<WaterStressBand, "level">[] = [
  { label: "Low", plain: "less than 10% of the water available here is already being used each year" },
  { label: "Low to medium", plain: "10–20% of the water available here is already being used each year" },
  { label: "Medium to high", plain: "20–40% of the water available here is already being used each year" },
  { label: "High", plain: "40–80% of the water available here is already being used each year" },
  {
    label: "Extremely high",
    plain: "more than 80% of the water available here is already being used each year",
  },
];

export function waterStressBand(score: number | null | undefined, category?: string | null): WaterStressBand {
  if (score === null || score === undefined || !Number.isFinite(score)) {
    const arid = category && /arid/i.test(category);
    return {
      level: null,
      label: arid ? "Dry, little water use" : "Not rated",
      plain: arid
        ? "a dry area where very little water is used, so WRI doesn't give it a stress score"
        : "WRI doesn't have a water stress rating for this spot",
    };
  }
  const level = Math.min(4, Math.max(0, Math.floor(score))) as 0 | 1 | 2 | 3 | 4;
  return { level, ...BANDS[level] };
}

const DROUGHT: Record<string, { label: string; plain: string }> = {
  none: { label: "No drought", plain: "isn't in drought right now" },
  D0: { label: "Abnormally dry", plain: "is abnormally dry right now, one step short of drought" },
  D1: { label: "Moderate drought", plain: "is in moderate drought right now" },
  D2: { label: "Severe drought", plain: "is in severe drought right now" },
  D3: { label: "Extreme drought", plain: "is in extreme drought right now" },
  D4: { label: "Exceptional drought", plain: "is in exceptional drought right now, the worst category" },
};

export function droughtPlain(level: string | null | undefined) {
  if (!level) return null;
  return DROUGHT[level] ?? { label: level, plain: `is rated ${level} by the US Drought Monitor` };
}

/**
 * A cooling-share percentage as words. Rounded to the nearest 5 because the
 * underlying values were read off a chart by eye (see coolingShares).
 */
export function sharePhrase(pct: number | null): string {
  if (pct === null) return "not tracked separately";
  if (pct === 0) return "almost none";
  if (pct < 5) return "under 5%";
  return `about ${Math.round(pct / 5) * 5}%`;
}

/** How many average U.S. homes one megawatt of continuous draw equals. */
export function homesPerMegawatt(): number {
  return (HOURS_PER_YEAR * 1000) / COEFFICIENTS.householdElectricity.kWhPerYear;
}
