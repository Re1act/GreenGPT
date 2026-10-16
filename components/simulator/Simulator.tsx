"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { COOLING_TYPES, simulate, type CoolingType, type SimulatorResult } from "@/lib/simulator/model";
import type { InitialScenario, LatLon, ScenarioInputs } from "@/lib/simulator/params";
import { fetchRegion, placeName, roundPoint, type RegionLookup } from "@/lib/simulator/region";
import type { AllocationMode } from "@/components/simulator/CostAllocation";
import LocationStep from "@/components/simulator/steps/LocationStep";
import SizeStep from "@/components/simulator/steps/SizeStep";
import CoolingStep from "@/components/simulator/steps/CoolingStep";
import PowerStep from "@/components/simulator/steps/PowerStep";
import YearStep from "@/components/simulator/steps/YearStep";
import ResultsStep from "@/components/simulator/steps/ResultsStep";
import type { SetInput, StepProps } from "@/components/simulator/steps/types";

// The simulator as a guided walkthrough: one decision per screen, each showing
// its consequences in plain English before moving on, ending in a summary. The
// location step takes the whole page; every later step shows the chosen place
// in the progress bar so the user never loses track of where they built.

export const STEPS = [
  { key: "location", label: "Location" },
  { key: "size", label: "Size" },
  { key: "cooling", label: "Cooling" },
  { key: "power", label: "Power" },
  { key: "year", label: "Opening year" },
  { key: "results", label: "Results" },
] as const;

export type StepKey = (typeof STEPS)[number]["key"];

function ProgressBar({
  current,
  furthest,
  onJump,
  place,
}: {
  current: number;
  furthest: number;
  onJump: (i: number) => void;
  place: string;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <ol className="flex flex-wrap items-center gap-1 text-xs">
        {STEPS.map((s, i) => {
          const reachable = i <= furthest;
          const active = i === current;
          return (
            <li key={s.key} className="flex items-center gap-1">
              {i > 0 && <span className="text-zinc-300 dark:text-zinc-600">›</span>}
              <button
                type="button"
                disabled={!reachable}
                onClick={() => onJump(i)}
                aria-current={active ? "step" : undefined}
                className={`rounded-full px-2.5 py-1 transition-colors ${
                  active
                    ? "bg-emerald-700 font-medium text-white dark:bg-emerald-500 dark:text-zinc-950"
                    : reachable
                      ? "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      : "cursor-default text-zinc-400 dark:text-zinc-600"
                }`}
              >
                {i + 1}. {s.label}
              </button>
            </li>
          );
        })}
      </ol>
      <button
        type="button"
        onClick={() => onJump(0)}
        className="self-start text-xs text-zinc-500 hover:text-zinc-900 sm:self-auto dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        Building in <span className="font-medium text-zinc-800 dark:text-zinc-200">{place}</span> ·
        change
      </button>
    </div>
  );
}

export default function Simulator({ initial }: { initial: InitialScenario }) {
  const [inputs, setInputs] = useState<ScenarioInputs>(initial.inputs);
  const [point, setPoint] = useState<LatLon | null>(initial.point);
  const [lookup, setLookup] = useState<RegionLookup>({
    status: initial.point ? "loading" : "idle",
    context: null,
  });
  const [allocation, setAllocation] = useState<AllocationMode>("socialized");
  const [step, setStep] = useState(0);
  const [furthest, setFurthest] = useState(0);
  const topRef = useRef<HTMLDivElement | null>(null);

  // Only the latest request's response is applied, so a slow earlier lookup
  // can't overwrite a newer one. State is only ever set from the fetch's
  // callbacks, never synchronously in the effect body.
  const requestId = useRef(0);
  const lookupRegion = useCallback((p: LatLon) => {
    const id = ++requestId.current;
    fetchRegion(p).then(
      (context) => {
        if (id === requestId.current) setLookup({ status: "ready", context });
      },
      (err) => {
        console.error(err);
        if (id === requestId.current) setLookup({ status: "error", context: null });
      }
    );
  }, []);

  // A facility link arrives with a point; look it up once on mount (initial
  // state is already "loading" for this case).
  useEffect(() => {
    if (initial.point) lookupRegion(initial.point);
  }, [initial.point, lookupRegion]);

  const handlePick = useCallback(
    (raw: LatLon) => {
      const p = roundPoint(raw);
      setPoint(p);
      setLookup((prev) => ({ status: "loading", context: prev.context }));
      lookupRegion(p);
    },
    [lookupRegion]
  );

  const set: SetInput = useCallback(
    (key, value) => setInputs((prev) => ({ ...prev, [key]: value })),
    []
  );

  const goToIndex = (i: number) => {
    const next = Math.max(0, Math.min(STEPS.length - 1, i));
    setStep(next);
    setFurthest((f) => Math.max(f, next));
    topRef.current?.scrollIntoView({ block: "start" });
  };
  const goTo = (key: StepKey) => goToIndex(STEPS.findIndex((s) => s.key === key));

  // While a new pick is loading, keep modeling the previous region rather than
  // flashing the U.S. average for a moment.
  const subregionCode = lookup.context?.egrid[0]?.subregion_code ?? null;
  const byCooling = useMemo(
    () =>
      Object.fromEntries(
        COOLING_TYPES.map((c) => [c, simulate({ ...inputs, subregionCode, cooling: c })])
      ) as Record<CoolingType, SimulatorResult>,
    [inputs, subregionCode]
  );
  const result = byCooling[inputs.cooling];

  const current = STEPS[step].key;

  if (current === "location") {
    return (
      <div ref={topRef} className="h-full">
        <LocationStep
          point={point}
          lookup={lookup}
          onPick={handlePick}
          onContinue={() => goToIndex(1)}
          facilityName={initial.facilityName}
          preloaded={[
            initial.fromFacility.load && "size",
            initial.fromFacility.cooling && "cooling",
            initial.fromFacility.buildYear && "opening year",
          ].filter((x): x is string => Boolean(x))}
        />
      </div>
    );
  }

  const stepProps: StepProps = { inputs, set, result, byCooling, lookup };
  const isLast = step === STEPS.length - 1;

  return (
    <div ref={topRef} className="flex min-h-full flex-col">
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 pb-8 pt-4">
        <ProgressBar
          current={step}
          furthest={furthest}
          onJump={goToIndex}
          place={placeName(lookup.context, point)}
        />
        <div className="mt-6">
          {current === "size" && <SizeStep {...stepProps} />}
          {current === "cooling" && <CoolingStep {...stepProps} />}
          {current === "power" && <PowerStep {...stepProps} />}
          {current === "year" && <YearStep {...stepProps} />}
          {current === "results" && (
            <ResultsStep
              {...stepProps}
              point={point}
              goTo={goTo}
              allocation={allocation}
              onAllocationChange={setAllocation}
              onStartOver={() => {
                setFurthest(0);
                goToIndex(0);
              }}
            />
          )}
        </div>
      </div>

      {!isLast && (
        <div className="sticky bottom-0 border-t border-black/10 bg-white/95 backdrop-blur dark:border-white/10 dark:bg-zinc-950/95">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <button
              type="button"
              onClick={() => goToIndex(step - 1)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={() => goToIndex(step + 1)}
              className="rounded-lg bg-emerald-700 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
            >
              {step === STEPS.length - 2 ? "See the results →" : "Next →"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
