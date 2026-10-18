"use client";

import COEFFICIENTS from "@/lib/simulator/coefficients.json";
import { formatRange, litersToMillionGallons } from "@/lib/simulator/format";
import { COOLING_COPY } from "@/lib/simulator/copy";
import { COOLING_TYPES, type CoolingType, type Range } from "@/lib/simulator/model";
import { sharePhrase } from "@/lib/simulator/plainEnglish";
import CoolingComparison from "@/components/simulator/CoolingComparison";
import { ChoiceCard, Explainer, Fact, StepQuestion, WhatHappens } from "@/components/simulator/ui";
import type { StepProps } from "@/components/simulator/steps/types";

const pct = (r: Range) => `${Math.round(r.low)}–${Math.round(r.high)}`;

const SHARES = COEFFICIENTS.coolingShares;

function ShareLine({ cooling }: { cooling: CoolingType }) {
  const s = SHARES.byCooling[cooling];
  if (s.hyperscalePct === null && s.aiPct === null) {
    return (
      <>
        <span className="font-medium text-zinc-800 dark:text-zinc-200">How common:</span> not
        tracked separately in national estimates yet
      </>
    );
  }
  return (
    <>
      <span className="font-medium text-zinc-800 dark:text-zinc-200">How common ({SHARES.year}):</span>{" "}
      {sharePhrase(s.hyperscalePct)} of large data centers · {sharePhrase(s.aiPct)} of AI data
      centers
    </>
  );
}

export default function CoolingStep({ inputs, set, result, byCooling }: StepProps) {
  const water = litersToMillionGallons(result.onsiteWaterL);
  const nearlyNoWater = water.high < 1;
  const overheadPer100 = { low: (result.pue.low - 1) * 100, high: (result.pue.high - 1) * 100 };

  return (
    <div className="flex flex-col gap-8">
      <div className="grid items-start gap-5 md:grid-cols-2">
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
                footer={<ShareLine cooling={c} />}
              >
                {inputs.cooling === c ? COOLING_COPY[c].body : null}
              </ChoiceCard>
            ))}
          </div>
          <Explainer title="Where do the “how common” numbers come from?">
            From a 2024 Lawrence Berkeley National Laboratory study of U.S. data centers. It
            estimated how cooling was split in {SHARES.year} using equipment sales data and input
            from industry experts. &ldquo;Large data centers&rdquo; are the giant facilities run by
            companies like Amazon, Microsoft, and Google. &ldquo;AI data centers&rdquo; are the ones
            built for AI chips, which run hotter and are moving to liquid cooling. The numbers are
            rounded because they were read off a chart. The study doesn&apos;t count submerged
            servers separately.
          </Explainer>
        </div>

        <div className="flex min-w-0 flex-col gap-4 md:sticky md:top-4 md:self-start">
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
      <section className="rounded-2xl border border-black/10 bg-white/70 p-4" aria-label="Cooling options comparison">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          How the five options compare here
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
      </div>


    </div>
  );
}
