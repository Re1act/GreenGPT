"use client";

import COEFFICIENTS from "@/lib/simulator/coefficients.json";
import RegionPicker from "@/components/simulator/RegionPicker";
import { HowCommon } from "@/components/simulator/ui";
import { describeMix, droughtPlain, mixForSubregion, waterStressBand } from "@/lib/simulator/plainEnglish";
import { placeName, type RegionLookup } from "@/lib/simulator/region";
import type { LatLon } from "@/lib/simulator/params";

const LOC = COEFFICIENTS.contextStats.location;

function PlaceFacts({ lookup }: { lookup: RegionLookup }) {
  if (lookup.status === "loading") {
    return <p className="text-[13px] leading-5 text-zinc-500 dark:text-zinc-400">Looking up this spot…</p>;
  }
  if (lookup.status === "error" || !lookup.context) {
    return (
      <p className="text-[13px] leading-5 text-zinc-600 dark:text-zinc-400">
        We couldn&apos;t look up details for this spot, so the simulator will use U.S. averages
        for its power grid. You can still continue.
      </p>
    );
  }

  const ctx = lookup.context;
  const water = ctx.water_stress
    ? waterStressBand(ctx.water_stress.baseline_stress_score, ctx.water_stress.baseline_stress_category)
    : null;
  const drought = droughtPlain(ctx.drought?.drought_level);
  const code = ctx.egrid[0]?.subregion_code ?? null;

  return (
    <dl className="flex flex-col gap-2 text-[13px] leading-5">
      <div>
        <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Water</dt>
        <dd className="text-zinc-800 dark:text-zinc-200">
          {water ? (
            <>
              <strong>{water.label} water stress.</strong> That means {water.plain}.
            </>
          ) : (
            "No water stress rating covers this spot."
          )}
        </dd>
      </div>
      <div>
        <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Drought</dt>
        <dd className="text-zinc-800 dark:text-zinc-200">
          {drought ? (
            <>
              This county {drought.plain}
              {ctx.drought?.as_of_date ? ` (as of ${ctx.drought.as_of_date})` : ""}.
            </>
          ) : (
            "No current drought reading for this county."
          )}
        </dd>
      </div>
      <div>
        <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Electricity</dt>
        <dd className="text-zinc-800 dark:text-zinc-200">
          {code ? (
            <>The local power grid mostly runs on {describeMix(mixForSubregion(code))}.</>
          ) : (
            <>
              This spot isn&apos;t inside a mapped power region, so we&apos;ll use the U.S. average
              mix: {describeMix(mixForSubregion(null))}.
            </>
          )}
        </dd>
      </div>
    </dl>
  );
}

export default function LocationStep({
  point,
  lookup,
  onPick,
  onContinue,
  facilityName,
  preloaded,
}: {
  point: LatLon | null;
  lookup: RegionLookup;
  onPick: (p: LatLon) => void;
  onContinue: () => void;
  facilityName: string | null;
  /** Which of the facility's details were disclosed and preloaded (e.g. "size"). */
  preloaded: string[];
}) {
  const canContinue = point !== null && lookup.status !== "loading";

  return (
    <div className="relative h-full min-h-0 overflow-hidden">
      <RegionPicker point={point} onPick={onPick} />

      <div className="pointer-events-none absolute inset-x-3 bottom-10 top-3 flex items-start sm:inset-x-auto sm:bottom-4 sm:left-4 sm:top-4 sm:w-96">
        <div className="pointer-events-auto flex max-h-full w-full flex-col overflow-hidden rounded-2xl border border-black/10 bg-white/95 p-4 shadow-xl backdrop-blur dark:border-white/10 dark:bg-zinc-900/95">
          <div className="shrink-0">
          <div className="text-[11px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
            Step 1 of 6
          </div>
          <h1 className="mt-1 text-lg leading-snug font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Where would you build a data center?
          </h1>
          <p className="mt-2 text-[13px] leading-5 text-zinc-600 dark:text-zinc-400">
            {facilityName ? (
              <>
                We&apos;ve placed you at <strong>{facilityName}</strong>, a real project from the
                map. You can keep this spot or click anywhere else.{" "}
                {preloaded.length > 0
                  ? `Its publicly reported ${preloaded.join(" and ")} ${preloaded.length > 1 ? "are" : "is"} filled in for you; you'll pick the rest.`
                  : "Its size and design aren't public, so you'll choose those yourself."}
              </>
            ) : (
              "Click anywhere on the map. Where you build changes how much the water and the electricity matter."
            )}
          </p>

          {point && (
            <div className="mt-3 border-t border-black/10 pt-3 dark:border-white/10">
              <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Selected location</p>
              <p className="mt-1 text-sm font-semibold leading-5 text-zinc-900 dark:text-zinc-50" aria-live="polite">
                {placeName(lookup.context, point)}
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={onContinue}
            disabled={!canContinue}
            className="mt-3 w-full rounded-lg bg-emerald-700 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400"
          >
            {point ? (lookup.status === "loading" ? "Looking up location…" : "Build here →") : "Pick a spot on the map first"}
          </button>
          </div>

          <div className="mt-3 min-h-0 overflow-y-auto overscroll-contain pr-1" role="region" aria-label="Location context" tabIndex={0}>
          {point && <div className="border-t border-black/10 pt-3"><PlaceFacts lookup={lookup} /></div>}
          <div className="mt-3 [&>div]:p-2.5 [&>div]:text-[12px] [&>div]:leading-5 [&>div>div:first-child]:text-[11px]">
            <HowCommon
              title="Where data centers are going"
              source="The Guardian (2026); Lawrence Berkeley National Laboratory (2024)"
            >
              About two-thirds of planned U.S. data centers ({LOC.plannedInDrought.count} of{" "}
              {LOC.plannedInDrought.of}) are in places that were in drought at some point in the past
              year. {LOC.topStates.states[0]} uses the most data center electricity, followed by{" "}
              {LOC.topStates.states[1]} and {LOC.topStates.states[2]}.
            </HowCommon>
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            This is a model of a made-up building, not a measurement of any real one.
          </p>
          </div>
        </div>
      </div>
    </div>
  );
}
