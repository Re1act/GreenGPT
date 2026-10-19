import Link from "next/link";
import HomeMapPreview from "@/components/map/HomeMapPreview";

const TOOLS = [
  { href: "/simulate", number: "01", title: "Explore the tradeoffs", name: "Simulator", body: "Build a hypothetical data center. Change its location, size, cooling, and power source to explore estimates of water use, electricity demand, and emissions.", action: "Try the simulator" },
  { href: "/map", number: "02", title: "See where it happens", name: "Map", body: "Explore facility locations and project status. Search for a city or postal code, zoom into your community, and select a facility to learn more.", action: "Explore the map" },
  { href: "/brief", number: "03", title: "Connect with your community", name: "Local brief", body: "Find nearby projects, explore sourced civic information, and draft a comment in your own words. Coverage varies by location.", action: "Build your local brief" },
];

export default function Home() {
  return (
    <main className="home-page">
      <section className="home-hero grid items-center gap-8 md:grid-cols-2 lg:gap-12" aria-labelledby="home-title">
        <div className="relative z-10 max-w-2xl">
          <h1 id="home-title" className="text-4xl font-semibold leading-[1.08] tracking-tight text-[#174b50] lg:text-5xl xl:text-6xl">Understand the water<br className="hidden sm:block" /> behind AI.</h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-[#4c696b] lg:text-lg">Explore how the location, power source, and cooling system of a data center affect its water and electricity use. Discover the tradeoffs, find projects near you, and learn how you can take part in decisions that affect your community.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/simulate" className="rounded-full bg-[#236973] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#174b50]">Explore the simulator</Link>
            <Link href="/brief" className="rounded-full border border-[#9abbb9] bg-white/50 px-6 py-3 text-sm font-semibold text-[#174b50] hover:bg-white">View your local brief</Link>
          </div>
        </div>
        <HomeMapPreview />
      </section>
      <section aria-labelledby="tools-title" className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-3"><div><h2 id="tools-title" className=" text-2xl font-semibold tracking-tight text-[#174b50]">Three ways to explore</h2></div><p className="max-w-sm text-sm leading-6 text-[#526968]">Start with a question. Follow it from an estimate to a place to a local decision.</p></div>
        <div className="grid gap-5 md:grid-cols-3">
          {TOOLS.map(tool => <Link href={tool.href} key={tool.href} className="tool-card group flex flex-col rounded-2xl border border-[#d4e1db] bg-[#fffefa] p-6 transition hover:-translate-y-1 hover:border-[#82aaa8] hover:shadow-lg">
            <div className="flex items-center justify-between"><span className="text-sm font-medium text-[#628b89]">{tool.number} / {tool.name}</span></div>
            <h3 className="mt-6 text-xl font-semibold tracking-tight text-[#174b50]">{tool.title}</h3><p className="mb-8 mt-3 text-sm leading-6 text-[#526968]">{tool.body}</p><span className="mt-auto flex items-center justify-between border-t border-[#e0e8df] pt-4 text-sm font-semibold text-[#236973]">{tool.action}<span aria-hidden="true">↗</span></span>
          </Link>)}
        </div>
      </section>
      <footer className="mx-auto flex max-w-7xl flex-wrap justify-between gap-3 border-t border-[#d4e1db] px-5 py-6 text-xs leading-5 text-[#526968] sm:px-8"><span>GreenGPT</span><span>Estimates invite questions. Local context matters.</span></footer>
    </main>
  );
}
