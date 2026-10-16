"use client";

import { formatRange, litersToMillionGallons } from "@/lib/simulator/format";
import { COOLING_COPY } from "@/lib/simulator/copy";
import { COOLING_TYPES, type Range } from "@/lib/simulator/model";
import CoolingComparison from "@/components/simulator/CoolingComparison";
import { ChoiceCard, Fact, StepQuestion, WhatHappens } from "@/components/simulator/ui";
import type { StepProps } from "@/components/simulator/steps/types";

const pct = (r: Range) => `${Math.round(r.low)}–${Math.round(r.high)}`;

export default function CoolingStep({ inputs, set, result, byCooling }: StepProps) {
  const water = litersToMillionGallons(result.onsiteWaterL);
  const nearlyNoWater = water.high < 1;
  const overheadPer100 = { low: (result.pue.low - 1) * 100, high: (result.pue.high - 1) * 100 };

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="flex flex-col gap-5">
          <StepQuestion
            eyebrow="Step 3 of 6 · Cooling"
            title="Computers turn electricity into heat. How do you get rid of it?"
          >
            <p>
              Servers break if they overheat, so all that heat has to go somewhere. Every way of
              cooling a building this size trades water against electricity.
            </p>
          </StepQuestion>
          <div className="flex flex-col gap-3">
            {COOLING_TYPES.map((c) => (
              <ChoiceCard
                key={c}
                selected={inputs.cooling === c}
                onSelect={() => set("cooling", c)}
                title={COOLING_COPY[c].title}
                subtitle={COOLING_COPY[c].analogy}
                tags={[COOLING_COPY[c].water, COOLING_COPY[c].power]}
              >
                {COOLING_COPY[c].body}
              </ChoiceCard>
            ))}
          </div>
        </div>

        <div className="lg:sticky lg:top-4 lg:self-start">
          <WhatHappens>
            <Fact
              label="Water used up at the building each year"
              value={nearlyNoWater ? "Almost none" : <>{formatRange(water)} million gallons</>}
            >
              {nearlyNoWater ? (
                "This design doesn't evaporate water to cool itself."
              ) : (
                <>
                  About what {formatRange(result.onsiteWaterHouseholds)} American families use at
                  home in a year. This water evaporates, so it doesn&apos;t go back to the river or
                  aquifer it came from.
                </>
              )}
            </Fact>
            <Fact
              label="Extra electricity for cooling and other equipment"
              value={<>{formatRange(result.overheadHomes)} homes&apos; worth a year</>}
            >
              This is on top of the computers&apos; own use. For every 100 units of electricity the
              computers use, this design adds about {pct(overheadPer100)} more.
            </Fact>
            <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              Designs that save water at the building usually spend more electricity, and power
              plants use water too. You&apos;ll see that on the next step.
            </p>
          </WhatHappens>
        </div>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          How the four options compare here
        </h2>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          Same place and size. Each bar runs from the best case to the worst case. Click a row to
          pick it.
        </p>
        <div className="mt-3">
          <CoolingComparison
            results={byCooling}
            selected={inputs.cooling}
            onSelect={(c) => set("cooling", c)}
          />
        </div>
      </section>
    </div>
  );
}
