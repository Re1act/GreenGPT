"use client";

import { useState } from "react";

import {
  DIVERGING_BLUE,
  DIVERGING_MIDPOINT,
  DIVERGING_RED,
  DROUGHT_COLORS,
  FACILITY_STATUS_COLORS,
  FACILITY_STATUS_LABELS,
  MUTED_GRAY,
  SEQ_150,
  SEQ_300,
  SEQ_450,
  SEQ_600,
  SEQ_700,
} from "@/lib/map/colors";

export type OverlayKey = "none" | "water-stress" | "drought" | "egrid" | "electricity-price";

const OVERLAYS: { key: OverlayKey; label: string }[] = [
  { key: "none", label: "None" },
  { key: "water-stress", label: "Water stress" },
  { key: "drought", label: "Current drought" },
  { key: "egrid", label: "Grid carbon intensity" },
  { key: "electricity-price", label: "Electricity price change" },
];

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span
        className="h-3 w-3 shrink-0 rounded-sm border border-black/10"
        style={{ backgroundColor: color }}
      />
      <span className="text-zinc-700 dark:text-zinc-300">{label}</span>
    </div>
  );
}

function OverlayLegend({ overlay }: { overlay: OverlayKey }) {
  if (overlay === "none") {
    return (
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Pick a layer above to see basin, county, or state context.
      </p>
    );
  }

  if (overlay === "water-stress") {
    return (
      <div className="flex flex-col gap-1">
        <Swatch color={SEQ_150} label="Low" />
        <Swatch color={SEQ_300} label="Low-medium" />
        <Swatch color={SEQ_450} label="Medium-high" />
        <Swatch color={SEQ_600} label="High" />
        <Swatch color={SEQ_700} label="Extremely high" />
        <Swatch color={MUTED_GRAY} label="Arid / not scored" />
        <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
          WRI Aqueduct baseline water stress, by basin.
        </p>
      </div>
    );
  }

  if (overlay === "drought") {
    return (
      <div className="flex flex-col gap-1">
        <Swatch color="#ffffff" label="None" />
        <Swatch color={DROUGHT_COLORS.D0} label="D0 — Abnormally dry" />
        <Swatch color={DROUGHT_COLORS.D1} label="D1 — Moderate" />
        <Swatch color={DROUGHT_COLORS.D2} label="D2 — Severe" />
        <Swatch color={DROUGHT_COLORS.D3} label="D3 — Extreme" />
        <Swatch color={DROUGHT_COLORS.D4} label="D4 — Exceptional" />
        <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
          US Drought Monitor, weekly, by county.
        </p>
      </div>
    );
  }

  if (overlay === "egrid") {
    return (
      <div className="flex flex-col gap-1">
        <Swatch color={SEQ_150} label="~200 lb CO₂e/MWh" />
        <Swatch color={SEQ_300} label="~600" />
        <Swatch color={SEQ_450} label="~1,000" />
        <Swatch color={SEQ_600} label="~1,400" />
        <Swatch color={SEQ_700} label="~1,800+" />
        <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
          EPA eGRID subregion CO₂e output emission rate.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <Swatch color={DIVERGING_BLUE} label="Price fell since 2020" />
      <Swatch color={DIVERGING_MIDPOINT} label="~Unchanged" />
      <Swatch color={DIVERGING_RED} label="Price rose since 2020" />
      <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
        Darker = larger change. EIA Form 861, residential, by state.
      </p>
    </div>
  );
}

export default function OverlayControl({
  overlay,
  onChange,
}: {
  overlay: OverlayKey;
  onChange: (o: OverlayKey) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={`pointer-events-auto flex shrink-0 flex-col gap-3 rounded-lg border border-black/10 p-3 shadow-lg dark:border-white/10 ${
      collapsed
        ? "w-56 bg-white/30 dark:bg-zinc-900/30"
        : "w-64 bg-white/95 backdrop-blur dark:bg-zinc-900/95"
    }`}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-700 dark:text-zinc-200">
          {collapsed ? "Map key" : "Overlay"}
        </h2>
        <button type="button" aria-expanded={!collapsed} aria-controls="map-overlay-options"
          aria-label={collapsed ? "Show layers" : "Hide layers"}
          title={collapsed ? "Show layers" : "Hide layers"}
          onClick={() => setCollapsed((value) => !value)}
          className="flex h-8 w-8 items-center justify-center rounded text-zinc-800 hover:bg-black/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:text-zinc-100 dark:hover:bg-white/10">
          <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4">
            <path d={collapsed ? "M3 8h10M8 3v10" : "M3 8h10"} strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div id="map-overlay-options" hidden={collapsed}>
        <div className="flex flex-col gap-1">
          {OVERLAYS.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => onChange(o.key)}
              className={`rounded px-2 py-1 text-left text-sm transition-colors ${
                overlay === o.key
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                  : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
      {(!collapsed || overlay !== "none") && (
        <div className="border-t border-black/10 pt-3 dark:border-white/10">
          {collapsed && (
            <h3 className="mb-2 text-xs font-semibold text-zinc-800 dark:text-zinc-100">
              {OVERLAYS.find(({ key }) => key === overlay)?.label}
            </h3>
          )}
          <OverlayLegend overlay={overlay} />
        </div>
      )}
      <div className="border-t border-black/10 pt-3 dark:border-white/10">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Facilities
        </h2>
        <div className="flex flex-col gap-1">
          {Object.entries(FACILITY_STATUS_LABELS).map(([status, label]) => (
            <Swatch key={status} color={FACILITY_STATUS_COLORS[status]} label={label} />
          ))}
        </div>
      </div>
    </div>
  );
}
