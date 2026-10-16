"use client";

import COEFFICIENTS from "@/lib/simulator/coefficients.json";
import { formatRange, litersToMillionGallons, scaleRange } from "@/lib/simulator/format";
import { COOLING_COPY, POWER_COPY, WHY_RANGES } from "@/lib/simulator/copy";
import { droughtPlain, waterStressBand } from "@/lib/simulator/plainEnglish";
import { placeName } from "@/lib/simulator/region";
import type { LatLon } from "@/lib/simulator/params";
import CoolingComparison from "@/components/simulator/CoolingComparison";
import CostAllocation, { type AllocationMode } from "@/components/simulator/CostAllocation";
import ShowYourWork from "@/components/simulator/ShowYourWork";
import { StepQuestion } from "@/components/simulator/ui";
import type { StepProps } from "@/components/simulator/steps/types";
import type { StepKey } from "@/components/simulator/Simulator";

function ResultCard({
  label,
  value,
  children,
  onChange,
  changeLabel,
}: {
  label: string;
  value: React.ReactNode;
  children: React.ReactNode;
  onChange: () => void;
  changeLabel: string;
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-black/10 p-5 dark:border-white/10">
      <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold leading-snug text-zinc-900 dark:text-zinc-50">{value}</div>
      <div className="mt-2 flex-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{children}</div>
      <button
        type="button"
        onClick={onChange}
        className="mt-3 self-start text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
      >
        {changeLabel} →
      </button>
    </div>
  );
}

function Panel({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-black/10 p-5 dark:border-white/10">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{title}</h2>
      {intro && <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{intro}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function ResultsStep({
  inputs,
  set,
  result,
  byCooling,
  lookup,
  point,
  goTo,
  allocation,
  onAllocationChange,
  onStartOver,
}: StepProps & {
  point: LatLon | null;
  goTo: (step: StepKey) => void;
  allocation: AllocationMode;
  onAllocationChange: (m: AllocationMode) => void;
  onStartOver: () => void;
}) {
  const ctx = lookup.status === "ready" ? lookup.context : null;
  const water = ctx?.water_stress
    ? waterStressBand(ctx.water_stress.baseline_stress_score, ctx.water_stress.baseline_stress_category)
    : null;
  const drought = droughtPlain(ctx?.drought?.drought_level);
  const onsite = litersToMillionGallons(result.onsiteWaterL);
  const plant = litersToMillionGallons(result.generationWaterL);
  const place = placeName(ctx, point);

  return (
    <div className="flex flex-col gap-8">
      <StepQuestion eyebrow="Step 6 of 6 · Results" title="Your data center, in one year">
        <p>
          A {inputs.itLoadMW.toLocaleString("en-US")} MW data center in {place}, cooled by{" "}
          {COOLING_COPY[inputs.cooling].title.toLowerCase()}, powered by{" "}
          {POWER_COPY[inputs.powerSource].title.toLowerCase()}, switching on in {inputs.buildYear}.
        </p>
      </StepQuestion>

      <div className="grid gap-4 sm:grid-cols-2">
        <ResultCard
          label="Electricity"
          value={<>{formatRange(result.electricityHomes)} homes&apos; worth</>}
          onChange={() => goTo("size")}
          changeLabel="Change the size"
        >
          {formatRange(scaleRange(result.annualMWh, 1 / 1000))} gigawatt-hours a year, counting
          the computers plus {formatRange(result.overheadHomes)} homes&apos; worth for cooling and
          other equipment.
        </ResultCard>
        <ResultCard
          label="Water used up at the building"
          value={onsite.high < 1 ? "Almost none" : <>{formatRange(onsite)} million gallons</>}
          onChange={() => goTo("cooling")}
          changeLabel="Change the cooling"
        >
          {onsite.high < 1
            ? "This cooling design doesn't evaporate water."
            : `About what ${formatRange(result.onsiteWaterHouseholds)} American families use at home in a year. It evaporates and doesn't come back.`}
        </ResultCard>
        <ResultCard
          label="Water used up at power plants"
          value={<>{formatRange(plant)} million gallons</>}
          onChange={() => goTo("power")}
          changeLabel="Change the power source"
        >
          Another {formatRange(result.generationWaterHouseholds)} families&apos; worth, used to cool
          the power plants that supply the building.
        </ResultCard>
        <ResultCard
          label="Greenhouse gas pollution"
          value={<>{formatRange(result.emissionsT)} metric tons</>}
          onChange={() => goTo("year")}
          changeLabel="Change the opening year"
        >
          About the same as {formatRange(result.emissionsCars)} cars driven for a year.
        </ResultCard>
      </div>

      <div className="rounded-2xl bg-zinc-50 p-5 text-sm leading-relaxed text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Why the place matters</h2>
        <p className="mt-1">
          {ctx ? (
            <>
              {water?.level !== null && water ? (
                <>
                  {place} has <strong>{water.label.toLowerCase()} water stress</strong>: {water.plain}.{" "}
                </>
              ) : (
                <>There&apos;s no water stress rating for this spot. </>
              )}
              {drought ? <>The county {drought.plain}. </> : null}
            </>
          ) : (
            <>Go back and pick a spot on the map to see its water and drought conditions. </>
          )}
          The same building uses about the same water wherever it goes. What changes is whether the
          area can spare it.
        </p>
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">{WHY_RANGES}</p>
      </div>

      <Panel
        title="What if you'd cooled it differently?"
        intro="Same place, size, power source, and year. Each bar runs from the best case to the worst case. Click a row to switch."
      >
        <CoolingComparison
          results={byCooling}
          selected={inputs.cooling}
          onSelect={(c) => set("cooling", c)}
        />
      </Panel>

      <Panel title="Who pays for the power plants it needs?">
        <CostAllocation
          result={result}
          mode={allocation}
          onModeChange={onAllocationChange}
          residentialCustomers={inputs.residentialCustomers}
          onCustomersChange={(n) => set("residentialCustomers", n)}
        />
      </Panel>

      <details className="rounded-2xl border border-black/10 p-5 dark:border-white/10">
        <summary className="cursor-pointer text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Show your work
        </summary>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          The exact formulas, numbers, and sources behind every result above.
        </p>
        <div className="mt-4">
          <ShowYourWork inputs={{ ...inputs, subregionCode: result.region.code }} result={result} />
        </div>
      </details>

      <section className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
        <p className="rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-200">
          These numbers are a draft. Every one is cited, but they&apos;re still being checked (
          {COEFFICIENTS.version}, as of {COEFFICIENTS.asOf}).
        </p>
        <h2 className="mt-4 font-semibold text-zinc-700 dark:text-zinc-300">Sources</h2>
        <ul className="mt-1 flex flex-col gap-1">
          {Object.entries(COEFFICIENTS.sources).map(([id, s]) => (
            <li key={id}>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#2a78d6] underline dark:text-[#6da7ec]"
              >
                {s.name}
              </a>{" "}
              ({s.date})
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={onStartOver}
          className="mt-6 rounded-lg border border-black/15 px-4 py-2 text-sm font-medium text-zinc-800 hover:border-zinc-400 dark:border-white/20 dark:text-zinc-200"
        >
          Start over somewhere else
        </button>
      </section>
    </div>
  );
}
