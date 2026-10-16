import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Local brief",
};

// Placeholder until the Local Brief (brief section C) is built. It needs the
// zip_centroids seed and an OpenStates ingest before it can show anything real.
export default function BriefPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Local brief</h1>
      <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        Coming next: enter a zip code to see facilities near you, your state&apos;s data center
        legislation, open utility rate cases with comment deadlines, your representatives, and
        local organizations already working on the issue.
      </p>
    </main>
  );
}
