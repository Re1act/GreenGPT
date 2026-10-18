"use client";

import { COOLING_COPY } from "@/lib/simulator/copy";
import { formatRange, litersToMillionGallons } from "@/lib/simulator/format";
import { COOLING_TYPES, type CoolingType, type Range, type SimulatorResult } from "@/lib/simulator/model";

// "There is no free option", made visible: every cooling architecture under the
// user's current site, load, power source, and build year, side by side. One
// measure per column, each on its own zero-based scale (never a shared or dual
// axis), drawn as low-high range bars in a single sequential hue -- one series,
// so no legend; the printed values double as the table view.

function RangeBar({ r, max, label }: { r: Range; max: number; label: string }) {
  const left = max > 0 ? (r.low / max) * 100 : 0;
  const width = max > 0 ? Math.max(((r.high - r.low) / max) * 100, 1.5) : 0;
  return (
    <div className="relative h-2 w-full rounded-full bg-zinc-100 dark:bg-zinc-800" title={label}>
      <div
        className="absolute inset-y-0 rounded-full bg-emerald-600"
        style={{ left: `${left}%`, width: `${Math.min(width, 100 - left)}%` }}
      />
    </div>
  );
}

export default function CoolingComparison({
  results,
  selected,
  onSelect,
}: {
  results: Record<CoolingType, SimulatorResult>;
  selected: CoolingType;
  onSelect: (c: CoolingType) => void;
}) {
  const rows = COOLING_TYPES.map((c) => {
    const r = results[c];
    return {
      cooling: c,
      label: COOLING_COPY[c].title,
      water: litersToMillionGallons(r.onsiteWaterL),
      energy: r.electricityHomes,
    };
  });
  const maxWater = Math.max(...rows.map((r) => r.water.high));
  const maxEnergy = Math.max(...rows.map((r) => r.energy.high));

  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed text-xs">
        <thead>
          <tr className="text-left text-xs text-zinc-500 dark:text-zinc-400">
            <th className="py-2 pr-2 font-medium">How it&apos;s cooled</th>
            <th className="w-[31%] py-2 pr-2 font-medium">Water used up at the building (million gallons a year)</th>
            <th className="w-[31%] py-2 font-medium">Total electricity (homes&apos; worth a year)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const active = row.cooling === selected;
            const waterText = formatRange(row.water);
            const energyText = formatRange(row.energy);
            return (
              <tr
                key={row.cooling}
                onClick={() => onSelect(row.cooling)}
                className={`cursor-pointer border-t border-black/5 dark:border-white/5 ${
                  active ? "bg-zinc-100 dark:bg-zinc-800/60" : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
                }`}
              >
                <td className="py-2 pr-2">
                  {/* Keyboard target; the click bubbles to the row's handler. */}
                  <button
                    type="button"
                    aria-pressed={active}
                    className={`text-left ${active ? "font-semibold text-zinc-900 dark:text-zinc-50" : "text-zinc-700 dark:text-zinc-300"}`}
                  >
                    {row.label}
                  </button>
                </td>
                <td className="py-2 pr-2">
                  <RangeBar r={row.water} max={maxWater} label={`${row.label}: ${waterText} million gallons a year`} />
                  <div className="mt-1 text-xs tabular-nums text-zinc-600 dark:text-zinc-400">{waterText}</div>
                </td>
                <td className="py-2">
                  <RangeBar r={row.energy} max={maxEnergy} label={`${row.label}: ${energyText} homes' worth of electricity a year`} />
                  <div className="mt-1 text-xs tabular-nums text-zinc-600 dark:text-zinc-400">{energyText}</div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
