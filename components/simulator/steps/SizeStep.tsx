"use client";

import COEFFICIENTS from "@/lib/simulator/coefficients.json";
import { formatRange, scaleRange, sig } from "@/lib/simulator/format";
import { MAX_IT_LOAD_MW, MIN_IT_LOAD_MW } from "@/lib/simulator/params";
import { homesPerMegawatt } from "@/lib/simulator/plainEnglish";
import { Explainer, Fact, HowCommon, StepQuestion, WhatHappens } from "@/components/simulator/ui";
import type { StepProps } from "@/components/simulator/steps/types";

const PRESETS = [10, 50, 100, 300, 1000];

// Log-scale slider: 1 MW to 2,000 MW spans three orders of magnitude, and a
// linear slider would cram everything under 100 MW into the first few pixels.
const LOG_MAX = Math.log10(MAX_IT_LOAD_MW);
const toSlider = (mw: number) => Math.round((Math.log10(mw) / LOG_MAX) * 1000);
const fromSlider = (v: number) => {
  const mw = 10 ** ((v / 1000) * LOG_MAX);
  return Math.max(MIN_IT_LOAD_MW, mw < 20 ? Math.round(mw) : Math.round(mw / 5) * 5);
};

const AVG = COEFFICIENTS.contextStats.size.averageNewMW;

function compareToAverage(mw: number): string {
  const ratio = mw / AVG.y2025;
  if (ratio >= 1.5) return `Yours would be about ${sig(ratio)} times that size.`;
  if (ratio <= 0.67) return `Yours would be smaller than that: about ${Math.round(ratio * 100)}% of the average.`;
  return "Yours is about average.";
}

export default function SizeStep({ inputs, set, result }: StepProps) {
  const homeMWh = COEFFICIENTS.householdElectricity.kWhPerYear / 1000;
  const itHomes = scaleRange(result.itOnlyMWh, 1 / homeMWh);
  const u = COEFFICIENTS.utilization;

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="flex flex-col gap-6">
        <StepQuestion eyebrow="Step 2 of 6 · Size" title="How big is it?">
          <p>
            Data centers are sized by how much electricity their computers can draw at once,
            measured in <strong>megawatts (MW)</strong>. One megawatt, running all year, is about
            what {sig(homesPerMegawatt())} average U.S. homes use.
          </p>
        </StepQuestion>

        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
              {inputs.itLoadMW.toLocaleString("en-US")}
            </span>
            <span className="text-lg text-zinc-600 dark:text-zinc-400">MW</span>
          </div>
          <input
            type="range"
            min={0}
            max={1000}
            value={toSlider(inputs.itLoadMW)}
            onChange={(e) => set("itLoadMW", fromSlider(Number(e.target.value)))}
            aria-label="Size in megawatts"
            className="mt-3 w-full accent-emerald-700 dark:accent-emerald-400"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {PRESETS.map((mw) => (
              <button
                key={mw}
                type="button"
                onClick={() => set("itLoadMW", mw)}
                aria-pressed={inputs.itLoadMW === mw}
                className={`rounded-full border px-3 py-1 text-sm tabular-nums transition-colors ${
                  inputs.itLoadMW === mw
                    ? "border-emerald-700 bg-emerald-50 text-emerald-900 dark:border-emerald-400 dark:bg-emerald-950/40 dark:text-emerald-200"
                    : "border-black/10 text-zinc-700 hover:border-zinc-400 dark:border-white/10 dark:text-zinc-300"
                }`}
              >
                {mw.toLocaleString("en-US")} MW
              </button>
            ))}
          </div>
        </div>

        <HowCommon source="FERC, 2025 State of the Markets report">
          The average U.S. data center that came online in 2025 was nearly {AVG.y2025} MW, up from{" "}
          {AVG.y2020} MW in 2020. {compareToAverage(inputs.itLoadMW)}
        </HowCommon>
      </div>

      <WhatHappens>
        <Fact
          label="Its computers alone would use"
          value={<>{formatRange(itHomes)} homes&apos; worth of electricity a year</>}
        >
          That&apos;s {formatRange(scaleRange(result.itOnlyMWh, 1 / 1000))} gigawatt-hours (GWh).
          A gigawatt-hour is a million kilowatt-hours, the unit on your electric bill.
        </Fact>
        <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          That&apos;s before cooling. Keeping the computers from overheating takes more electricity
          on top, and that depends on the next choice.
        </p>
        <Explainer title="Why is this a range?">
          Computers don&apos;t run flat out all the time. A national lab study of U.S. data centers
          (Lawrence Berkeley National Laboratory, 2024) found AI servers average 60–80% of their maximum draw and run 75–85% of
          the year. Combined, that&apos;s {Math.round(u.low * 100)}–{Math.round(u.high * 100)}% of
          the building&apos;s full size, which gives the low and high ends here.
        </Explainer>
      </WhatHappens>
    </div>
  );
}
