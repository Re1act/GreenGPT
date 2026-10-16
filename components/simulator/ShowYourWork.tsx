"use client";

import COEFFICIENTS from "@/lib/simulator/coefficients.json";
import { sig } from "@/lib/simulator/format";
import {
  HOURS_PER_YEAR,
  LBS_PER_METRIC_TON,
  LITERS_PER_GALLON,
  type Range,
  type SimulatorInputs,
  type SimulatorResult,
} from "@/lib/simulator/model";

// The brief's "show your work" panel: every formula, with the exact numbers
// that produced the low and high ends substituted in, followed by where each
// coefficient came from and how it was derived. Nothing is hidden behind a
// single headline number.

const s3 = (n: number) => sig(n, 3);

// The formulas below use the industry's terms; each one is defined here first.
const GLOSSARY: [string, string][] = [
  ["IT load (MW)", "how much electricity the computers can draw at once, in megawatts"],
  ["Utilization", "how hard the computers work on average, as a share of their maximum"],
  [
    "PUE (power usage effectiveness)",
    "total building electricity divided by the computers' electricity. 1.10 means cooling and other equipment add 10% on top",
  ],
  [
    "WUE (water usage effectiveness)",
    "liters of water used up at the building per kilowatt-hour the computers use",
  ],
  ["MWh / kWh", "megawatt-hours and kilowatt-hours: amounts of electricity used over time (1 MWh = 1,000 kWh)"],
  [
    "eGRID region",
    "one of the EPA's 27 U.S. power grid regions, each with a measured mix of power plants and pollution rate",
  ],
  [
    "CO₂e",
    "carbon dioxide plus other heat-trapping gases, counted as the amount of CO₂ with the same warming effect",
  ],
];

function Step({
  formula,
  low,
  high,
  note,
}: {
  formula: string;
  low: string;
  high: string;
  note?: string;
}) {
  return (
    <div className="rounded-md border border-black/10 p-3 dark:border-white/10">
      <code className="block font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100">{formula}</code>
      <div className="mt-2 grid gap-1 font-mono text-[11px] text-zinc-600 dark:text-zinc-400">
        <div>
          <span className="inline-block w-10 text-zinc-400 dark:text-zinc-500">low</span>
          {low}
        </div>
        <div>
          <span className="inline-block w-10 text-zinc-400 dark:text-zinc-500">high</span>
          {high}
        </div>
      </div>
      {note && <p className="mt-2 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">{note}</p>}
    </div>
  );
}

function Assumption({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <li className="border-t border-black/5 py-2 text-xs leading-relaxed text-zinc-600 dark:border-white/5 dark:text-zinc-400">
      <span className="font-medium text-zinc-800 dark:text-zinc-200">{title}. </span>
      {children}
    </li>
  );
}

export default function ShowYourWork({
  inputs,
  result: r,
}: {
  inputs: SimulatorInputs;
  result: SimulatorResult;
}) {
  const mw = s3(inputs.itLoadMW);
  const lPerKWh: Range = {
    low: (r.generationWaterGalPerMWh.low * LITERS_PER_GALLON) / 1000,
    high: (r.generationWaterGalPerMWh.high * LITERS_PER_GALLON) / 1000,
  };
  const cooling = COEFFICIENTS.cooling[inputs.cooling];
  const gw = COEFFICIENTS.generationWaterGalPerMWh;
  const traj = COEFFICIENTS.gridCarbonTrajectory;
  const fut = COEFFICIENTS.futureBuildUncertainty;
  const util = COEFFICIENTS.utilization;
  const power = COEFFICIENTS.powerSources[inputs.powerSource];
  const sourceName = (id: string) =>
    (COEFFICIENTS.sources as Record<string, { name: string }>)[id]?.name ?? id;

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid gap-x-6 gap-y-2 rounded-md bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-600 sm:grid-cols-2 dark:bg-zinc-900 dark:text-zinc-400">
        {GLOSSARY.map(([term, meaning]) => (
          <div key={term}>
            <dt className="inline font-semibold text-zinc-800 dark:text-zinc-200">{term}: </dt>
            <dd className="inline">{meaning}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
        The low end pairs every input&apos;s low value and the high end pairs every high value, so
        the bounds are the widest defensible envelope. A real facility falls somewhere inside it,
        and the midpoint is not an estimate.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <Step
          formula="annual_MWh = IT_load_MW × PUE × 8760 × utilization"
          low={`${mw} × ${s3(r.pue.low)} × ${HOURS_PER_YEAR} × ${s3(r.utilization.low)} = ${s3(r.annualMWh.low)} MWh`}
          high={`${mw} × ${s3(r.pue.high)} × ${HOURS_PER_YEAR} × ${s3(r.utilization.high)} = ${s3(r.annualMWh.high)} MWh`}
        />
        <Step
          formula="onsite_water_L = IT_kWh × WUE_L_per_kWh"
          low={`${s3(r.itOnlyMWh.low * 1000)} × ${s3(r.wue.low)} = ${s3(r.onsiteWaterL.low)} L`}
          high={`${s3(r.itOnlyMWh.high * 1000)} × ${s3(r.wue.high)} = ${s3(r.onsiteWaterL.high)} L`}
          note="WUE is measured per kilowatt-hour the computers use, so it multiplies the computers' electricity (IT_kWh = IT_load_MW × 8760 × utilization × 1000), not the whole building's."
        />
        <Step
          formula="offsite_water_L = annual_kWh × generation_water_L_per_kWh"
          low={`${s3(r.annualMWh.low * 1000)} × ${s3(lPerKWh.low)} = ${s3(r.generationWaterL.low)} L`}
          high={`${s3(r.annualMWh.high * 1000)} × ${s3(lPerKWh.high)} = ${s3(r.generationWaterL.high)} L`}
          note={`Generation water intensity ${s3(r.generationWaterGalPerMWh.low)}–${s3(r.generationWaterGalPerMWh.high)} gal/MWh (${power.label}), converted at ${LITERS_PER_GALLON} L/gal.`}
        />
        <Step
          formula="emissions_t = annual_MWh × carbon_rate_lb_per_MWh ÷ 2204.6"
          low={`${s3(r.annualMWh.low)} × ${s3(r.carbonLbPerMWh.low)} ÷ ${s3(LBS_PER_METRIC_TON)} = ${s3(r.emissionsT.low)} t`}
          high={`${s3(r.annualMWh.high)} × ${s3(r.carbonLbPerMWh.high)} ÷ ${s3(LBS_PER_METRIC_TON)} = ${s3(r.emissionsT.high)} t`}
          note={
            inputs.powerSource === "grid"
              ? `${r.region.name} eGRID2023 rate ${s3(r.region.co2eLbPerMWh)} lb CO₂e/MWh × build-year multiplier ${s3(r.gridCarbonMultiplier.low)}–${s3(r.gridCarbonMultiplier.high)}.`
              : undefined
          }
        />
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Where the coefficients come from
        </h3>
        <ul className="mt-1">
          <Assumption title={`PUE ${s3(cooling.pue.low)}–${s3(cooling.pue.high)}, WUE ${s3(cooling.wueSiteLPerKWh.low)}–${s3(cooling.wueSiteLPerKWh.high)} L/kWh (${cooling.label})`}>
            {sourceName(cooling.sourceId)}, {cooling.locator}. {cooling.derivation}
          </Assumption>
          {r.futureUncertaintyApplied && (
            <Assumption title={`Build year ${inputs.buildYear}: ranges widened ±${fut.spread * 100}%`}>
              {sourceName(fut.sourceId)}, {fut.locator}. {fut.derivation}
            </Assumption>
          )}
          <Assumption title={`Utilization ${s3(util.low)}–${s3(util.high)}`}>
            {sourceName(util.sourceId)}, {util.locator}. {util.derivation}
          </Assumption>
          <Assumption title="Generation water by fuel">
            {sourceName(gw.sourceId)}, {gw.locator}. {gw.derivation}
          </Assumption>
          <Assumption title={`Grid region: ${r.region.name}${r.region.code ? ` (${r.region.code})` : ""}`}>
            {r.region.isUsAverage
              ? "No eGRID subregion resolved for this site, so the U.S. average resource mix and emission rate are used."
              : "Resolved from the site you picked, using EPA eGRID2023 subregion boundaries. EPA notes these boundaries are approximate."}
          </Assumption>
          <Assumption title="Grid carbon by build year">
            {sourceName(traj.sourceId)}, {traj.locator}. {traj.derivation}
          </Assumption>
          <Assumption title={`Power source: ${power.label}`}>
            {inputs.powerSource === "onsite_gas"
              ? `${COEFFICIENTS.powerSources.onsite_gas.co2Derivation} ${COEFFICIENTS.powerSources.onsite_gas.waterDerivation}`
              : inputs.powerSource === "dedicated_renewables"
                ? COEFFICIENTS.powerSources.dedicated_renewables.derivation
                : power.description}
          </Assumption>
        </ul>
      </div>
    </div>
  );
}
