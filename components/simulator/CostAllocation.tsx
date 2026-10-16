"use client";

import COEFFICIENTS from "@/lib/simulator/coefficients.json";
import { formatRange, formatUsdRange } from "@/lib/simulator/format";
import type { SimulatorResult } from "@/lib/simulator/model";

export type AllocationMode = "socialized" | "large_load_pays";

const MODES: { key: AllocationMode; label: string }[] = [
  { key: "socialized", label: "It goes on everyone's bills" },
  { key: "large_load_pays", label: "The data center pays for it" },
];

// Illustrative only, and labeled that way in the UI. Who pays for new capacity
// is decided case by case in utility rate cases -- this shows the size of the
// question, not an answer to it. The contested-evidence table sits right
// underneath so no single number stands alone (brief section 3).
export default function CostAllocation({
  result,
  mode,
  onModeChange,
  residentialCustomers,
  onCustomersChange,
}: {
  result: SimulatorResult;
  mode: AllocationMode;
  onModeChange: (m: AllocationMode) => void;
  residentialCustomers: number;
  onCustomersChange: (n: number) => void;
}) {
  const { annualCapacityCostUsd, residentialShare, socializedPerHouseholdUsd } = result.cost;

  return (
    <div className="flex flex-col gap-4 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
      <p>
        A data center this big needs power plants ready to supply it. At full power it would draw
        about <strong className="tabular-nums">{formatRange(result.peakDemandMW)} MW</strong>. In
        PJM, the largest U.S. electricity market (13 states plus D.C.), reserving that much
        power plant capacity recently cost about{" "}
        <strong className="tabular-nums">{formatUsdRange(annualCapacityCostUsd)} a year</strong>.
        Someone has to pay that. Who pays is up to your state&apos;s utility regulators.
      </p>

      <div className="inline-flex w-fit flex-wrap rounded-lg border border-black/10 p-0.5 dark:border-white/10" role="group">
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            aria-pressed={mode === m.key}
            onClick={() => onModeChange(m.key)}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              mode === m.key
                ? "bg-emerald-700 text-white dark:bg-emerald-500 dark:text-zinc-950"
                : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === "socialized" ? (
        <p>
          If the cost is spread across every customer, households pay their share. Homes buy about{" "}
          {Math.round(residentialShare * 100)}% of U.S. electricity. Split across a utility with{" "}
          <label className="inline-flex items-baseline">
            <span className="sr-only">Number of households the utility serves</span>
            <input
              type="number"
              min={1000}
              step={50000}
              value={residentialCustomers}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n) && n > 0) onCustomersChange(Math.round(n));
              }}
              className="w-28 rounded border border-black/15 bg-transparent px-1.5 py-0.5 text-sm tabular-nums dark:border-white/20"
            />
          </label>{" "}
          households, that comes to about{" "}
          <strong className="tabular-nums">
            {formatUsdRange(socializedPerHouseholdUsd)} per household per year
          </strong>
          .
        </p>
      ) : (
        <p>
          If the data center is charged for the capacity it needs, it pays the full{" "}
          {formatUsdRange(annualCapacityCostUsd)} a year and households pay none of it. New Jersey
          passed a law in June 2026 (S731/A796) that requires this for data centers using 50 MW or
          more.
        </p>
      )}

      <p className="rounded-md bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
        This is a rough illustration, not a bill estimate. It counts only power plant capacity, at
        one market&apos;s prices (PJM&apos;s ${COEFFICIENTS.costAllocation.capacityPriceUsdPerMWDay.low}–$
        {COEFFICIENTS.costAllocation.capacityPriceUsdPerMWDay.high} per megawatt per day). It
        leaves out new power lines, which often cost more. The real split is decided in{" "}
        <strong>rate cases</strong>, public proceedings where regulators set what each kind of
        customer pays. Anyone can submit a comment in them.
      </p>

      <div>
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
          Do data centers raise everyone&apos;s electricity bills? Researchers disagree.
        </h3>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-xs">
            <thead className="text-zinc-500 dark:text-zinc-400">
              <tr>
                <th className="py-1.5 pr-3 font-medium">Who</th>
                <th className="py-1.5 pr-3 font-medium">What they found</th>
                <th className="py-1.5 font-medium">What it does and doesn&apos;t show</th>
              </tr>
            </thead>
            <tbody>
              {COEFFICIENTS.contestedEvidence.map((row) => (
                <tr key={row.source} className="border-t border-black/5 align-top dark:border-white/5">
                  <td className="py-2 pr-3 font-medium">{row.source}</td>
                  <td className="py-2 pr-3">{row.finding}</td>
                  <td className="py-2">{row.limits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
