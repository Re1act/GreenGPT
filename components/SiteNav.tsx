"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/simulate", label: "Simulator" },
  { href: "/map", label: "Map" },
  { href: "/brief", label: "Local brief" },
];

// Full-height pages put their title here instead of in a header row of their
// own, so the page keeps that vertical space.
const NAV_TITLES: Record<string, { title: string; description: string }> = {
  "/map": {
    title: "The data center buildout map",
    description: "Planned and operating data centers, with water, drought, carbon, and power price layers.",
  },
};

export default function SiteNav() {
  const pathname = usePathname();
  const page = NAV_TITLES[pathname];
  return (
    <header className="z-30 shrink-0 border-b border-[#cbdedc] bg-[#fbfcf8]">
      <nav aria-label="Main navigation" className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-5 gap-y-2 px-5 py-3 sm:px-8 sm:py-4">
        <Link href="/" aria-label="Kilowatch home" aria-current={pathname === "/" ? "page" : undefined} className="flex items-center gap-2.5 rounded-md text-xl font-semibold tracking-tight text-[#174b50]">
          <Image src="/kilowatch-mark.png" alt="" width={40} height={40} preload className="h-10 w-10" />
          Kilowatch
        </Link>
        {page && (
          <div className="sm:min-w-0 sm:flex-1 sm:border-l sm:border-[#cbdedc] sm:pl-5">
            <h1 className="sr-only text-sm font-semibold text-[#174b50] sm:not-sr-only">{page.title}</h1>
            <p className="hidden text-[0.6875rem] leading-snug text-[#526968] lg:block">{page.description}</p>
          </div>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-1 sm:gap-2">
          {LINKS.map(({href, label}) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`rounded-full px-3 py-2 text-sm font-medium transition-colors sm:px-5 ${active ? "bg-[#dceee9] text-[#174b50]" : "text-[#526968] hover:bg-[#eaf2ee] hover:text-[#174b50]"}`}>{label}</Link>;
          })}
        </div>
      </nav>
    </header>
  );
}
