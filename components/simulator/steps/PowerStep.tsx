"use client";

import { formatRange, litersToMillionGallons } from "@/lib/simulator/format";
import { POWER_COPY } from "@/lib/simulator/copy";
import { POWER_SOURCES, type Range } from "@/lib/simulator/model";
import { describeMix, mixForSubregion } from "@/lib/simulator/plainEnglish";
import { ChoiceCard, Explainer, Fact, StepQuestion, WhatHappens } from "@/components/simulator/ui";
import type { StepProps } from "@/components/simulator/steps/types";

const add = (a: Range, b: Range): Range => ({ low: a.low + b.low, high: a.high + b.high });

export default function PowerStep({ inputs, set, result, byCooling }: StepProps) {
  const plantWater = litersToMillionGallons(result.generationWaterL);
  const totalWater = litersToMillionGallons(add(result.onsiteWaterL, result.generationWaterL));
  const evaporative = byCooling.evaporative;
  const evapTotal = litersToMillionGallons(add(evaporative.onsiteWaterL, evaporative.generationWaterL));
  const mix = describeMix(mixForSubregion(result.region.code));

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="flex flex-col gap-5">
        <StepQuestion eyebrow="Step 4 of 6 · Power" title="Where does the electricity come from?">
          <p>
            The building needs electricity every hour of every day. Where it comes from decides how
            much pollution it causes. It also decides how much <em>more</em> water gets used,
            because most power plants use water to cool themselves too.
          </p>
        </StepQuestion>
        <div className="flex flex-col gap-3">
          {POWER_SOURCES.map((p) => (
            <ChoiceCard
              key={p}
              selected={inputs.powerSource === p}
              onSelect={() => set("powerSource", p)}
              title={POWER_COPY[p].title}
            >
              {POWER_COPY[p].body}
              {p === "grid" && <> Here, that&apos;s mostly {mix}.</>}
            </ChoiceCard>
          ))}
        </div>
      </div>

      <div className="lg:sticky lg:top-4 lg:self-start">
        <WhatHappens>
          <Fact
            label="Greenhouse gas pollution each year"
            value={<>{formatRange(result.emissionsT)} metric tons</>}
          >
            About the same as {formatRange(result.emissionsCars)} cars driven for a year.
            {inputs.powerSource === "dedicated_renewables" && (
              <>
                {" "}
                The low end assumes the contract really covers every hour. The high end is what
                happens if, hour by hour, the building actually runs on the local grid.
              </>
            )}
          </Fact>
          <Fact
            label="Water used up at the power plants"
            value={<>{formatRange(plantWater)} million gallons a year</>}
          >
            About what {formatRange(result.generationWaterHouseholds)} families use in a year. This
            is on top of the water used at the building. It doesn&apos;t count water evaporating
            off dam reservoirs, which nobody agrees how to split up.
          </Fact>
          <Fact
            label="Total water: building plus power plants"
            value={<>{formatRange(totalWater)} million gallons a year</>}
          >
            {inputs.cooling === "evaporative" ? (
              result.onsiteWaterL.low > result.generationWaterL.high ? (
                "Here, most of it is evaporated at the building itself."
              ) : (
                "Here, it's split between the building and the power plants."
              )
            ) : (
              <>
                With evaporative cooling it would be {formatRange(evapTotal)} million gallons. The
                water you save at the building is partly spent again at the power plant, because
                this design uses more electricity.
              </>
            )}
          </Fact>
          <Explainer title="How is the pollution measured?">
            In tons of &ldquo;CO₂-equivalent&rdquo;: carbon dioxide plus other heat-trapping gases
            like methane, converted to the amount of carbon dioxide that would warm the planet the
            same amount. For the local grid we use the EPA&apos;s measurements of the region&apos;s
            power plants (2023).
          </Explainer>
        </WhatHappens>
      </div>
    </div>
  );
}
