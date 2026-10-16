"use client";

import COEFFICIENTS from "@/lib/simulator/coefficients.json";
import { formatRange, sig } from "@/lib/simulator/format";
import { POWER_COPY } from "@/lib/simulator/copy";
import { MAX_BUILD_YEAR, MIN_BUILD_YEAR } from "@/lib/simulator/model";
import { Fact, StepQuestion, WhatHappens } from "@/components/simulator/ui";
import type { StepProps } from "@/components/simulator/steps/types";

export default function YearStep({ inputs, set, result }: StepProps) {
  const base = COEFFICIENTS.gridCarbonTrajectory.baseYear;
  const future = inputs.buildYear > base;
  const onGrid = inputs.powerSource === "grid";
  const drop = Math.round((1 - result.gridCarbonMultiplier.low) * 100);

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="flex flex-col gap-6">
        <StepQuestion eyebrow="Step 5 of 6 · Opening year" title="When does it switch on?">
          <p>
            The power grid is changing as old plants close and new ones open, but nobody knows
            exactly how fast. Newer cooling designs are also less proven than older ones.
          </p>
        </StepQuestion>
        <div>
          <div className="text-4xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
            {inputs.buildYear}
          </div>
          <input
            type="range"
            min={MIN_BUILD_YEAR}
            max={MAX_BUILD_YEAR}
            step={1}
            value={inputs.buildYear}
            onChange={(e) => set("buildYear", Number(e.target.value))}
            aria-label="Opening year"
            className="mt-3 w-full accent-emerald-700 dark:accent-emerald-400"
          />
          <div className="mt-1 flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span>{MIN_BUILD_YEAR}</span>
            <span>{MAX_BUILD_YEAR}</span>
          </div>
        </div>
      </div>

      <WhatHappens>
        <Fact
          label="Greenhouse gas pollution in its first year"
          value={<>{formatRange(result.emissionsT)} metric tons</>}
        >
          {!onGrid ? (
            <>
              You picked {POWER_COPY[inputs.powerSource].title.toLowerCase()}, so changes to the
              local grid over time don&apos;t change this number.
            </>
          ) : future ? (
            <>
              The government&apos;s energy forecast (U.S. Energy Information Administration, 2026)
              expects the grid&apos;s pollution per unit of electricity to fall about {drop}% by{" "}
              {Math.min(inputs.buildYear, MAX_BUILD_YEAR)}. That&apos;s the low end. The high end
              assumes the grid doesn&apos;t get any cleaner. U.S. power plant emissions actually rose
              in 2025, so that&apos;s possible too.
            </>
          ) : (
            "Based on how the region's power plants actually ran in 2023, the latest full measurement."
          )}
        </Fact>
        {result.futureUncertaintyApplied && (
          <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            For buildings opening in {COEFFICIENTS.futureBuildUncertainty.fromYear} or later, we
            widen the water and cooling-electricity ranges by{" "}
            {sig(COEFFICIENTS.futureBuildUncertainty.spread * 100)}%, following the national lab
            study. Newer designs could do better or worse than today&apos;s.
          </p>
        )}
      </WhatHappens>
    </div>
  );
}
