import Link from "next/link";

const STEPS = [
  {
    href: "/simulate",
    step: "Understand",
    title: "Simulator",
    body: "Site a hypothetical facility and watch the water, power, and emissions tradeoffs move. There is no free option.",
  },
  {
    href: "/map",
    step: "Locate",
    title: "Map",
    body: "See what's operating, under construction, and proposed nationally, against drought, water stress, and grid carbon.",
  },
  {
    href: "/brief",
    step: "Act",
    title: "Local brief",
    body: "Enter a zip code to find nearby projects, state legislation, and the public comment windows that decide who pays.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-emerald-900 dark:text-emerald-300">
        GreenGPT
      </h1>
      <p className="mt-1 text-lg text-zinc-600 dark:text-zinc-400">
        A civic tool for the data center buildout
      </p>
      <p className="mt-6 max-w-2xl text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        Your own chatbot use is a rounding error, and no one can tell you which facility answered
        your prompt. The aggregate buildout, and where it lands, is a different story. GreenGPT
        doesn&apos;t compute a personal footprint. It explains the mechanism, shows where the
        impact lands, and points to where decisions get made.
      </p>
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {STEPS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="group rounded-lg border border-black/10 p-4 transition-colors hover:border-zinc-400 dark:border-white/10 dark:hover:border-zinc-500"
          >
            <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {s.step}
            </div>
            <div className="mt-1 font-semibold text-zinc-900 group-hover:underline dark:text-zinc-50">
              {s.title} →
            </div>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{s.body}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
