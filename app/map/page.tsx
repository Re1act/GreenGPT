import type { Metadata } from "next";
import MapView from "@/components/map/MapView";

export const metadata: Metadata = {
  title: "Data center buildout map",
  description:
    "Operating, under-construction, and proposed US data center facilities, with water stress, drought, grid carbon, and electricity price context.",
};

export default function MapPage() {
  return (
    <div className="flex h-full flex-col">
      <header className="z-20 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-black/10 bg-white px-4 py-2 dark:border-white/10 dark:bg-zinc-950">
        <div>
          <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            The data center buildout map
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Operating, under-construction, and proposed facilities, with water stress, drought,
            grid carbon, and electricity price context.
          </p>
        </div>
        {/* Hard constraint from the project brief, stated in the UI rather than a
            footnote: this map cannot and does not claim to trace any request to
            a facility. Inference routing is dynamic and undisclosed by every
            provider -- any tool claiming otherwise is fabricating. */}
        <p className="max-w-md text-right text-[11px] leading-tight text-zinc-500 dark:text-zinc-400">
          This map shows where facilities are being built — it cannot and does not show which
          facility served any specific request.
        </p>
      </header>
      <main className="min-h-0 flex-1">
        <MapView />
      </main>
    </div>
  );
}
