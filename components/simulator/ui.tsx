"use client";

// Small presentational pieces shared by the walkthrough steps.

export function StepQuestion({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
        {eyebrow}
      </div>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{title}</h1>
      {children && (
        <div className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{children}</div>
      )}
    </div>
  );
}

export function ChoiceCard({
  selected,
  onSelect,
  title,
  subtitle,
  children,
  tags,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  tags?: string[];
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`w-full rounded-xl border p-4 text-left transition-colors ${
        selected
          ? "border-emerald-700 bg-emerald-50 ring-1 ring-emerald-700 dark:border-emerald-400 dark:bg-emerald-950/40 dark:ring-emerald-400"
          : "border-black/10 hover:border-zinc-400 dark:border-white/10 dark:hover:border-zinc-500"
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-semibold text-zinc-900 dark:text-zinc-50">{title}</span>
        {subtitle && <span className="text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</span>}
      </div>
      {children && (
        <p className="mt-1.5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{children}</p>
      )}
      {tags && tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span
              key={t}
              className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

/** The "what happens" panel beside each step's choices. */
export function WhatHappens({ children }: { children: React.ReactNode }) {
  return (
    <aside className="rounded-2xl bg-zinc-50 p-5 dark:bg-zinc-900">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        What happens
      </h2>
      <div className="mt-3 flex flex-col gap-5">{children}</div>
    </aside>
  );
}

/** One headline consequence: a big plain-English figure plus a sentence of context. */
export function Fact({
  label,
  value,
  children,
}: {
  label: string;
  value: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className="mt-0.5 text-xl font-semibold leading-snug text-zinc-900 dark:text-zinc-50">{value}</div>
      {children && (
        <div className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{children}</div>
      )}
    </div>
  );
}

export function Explainer({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/10">
      <summary className="cursor-pointer text-zinc-700 dark:text-zinc-300">{title}</summary>
      <div className="mt-2 leading-relaxed text-zinc-600 dark:text-zinc-400">{children}</div>
    </details>
  );
}
