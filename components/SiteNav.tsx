"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/simulate", label: "Simulator" },
  { href: "/map", label: "Map" },
  { href: "/brief", label: "Local brief" },
];

export default function SiteNav() {
  const pathname = usePathname();
  return (
    <header className="z-30 shrink-0 border-b border-[#cbdedc] bg-[#fbfcf8]">
      <nav aria-label="Main navigation" className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-5 gap-y-2 px-5 py-3 sm:px-8 sm:py-4">
        <Link href="/" aria-label="GreenGPT home" aria-current={pathname === "/" ? "page" : undefined} className="flex items-center gap-2.5 rounded-md text-xl font-semibold tracking-tight text-[#174b50]">
          <svg aria-hidden="true" viewBox="0 0 32 36" className="h-8 w-7" fill="none"><path d="M16 2C12 9 3 17 3 23a13 13 0 0 0 26 0C29 17 20 9 16 2Z" fill="#33828a"/><path d="M8 24c5-5 11 5 17-1" stroke="#d5eee5" strokeWidth="2" strokeLinecap="round"/></svg>
          GreenGPT
        </Link>
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          {LINKS.map(({href, label}) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`rounded-full px-3 py-2 text-sm font-medium transition-colors sm:px-5 ${active ? "bg-[#dceee9] text-[#174b50]" : "text-[#526968] hover:bg-[#eaf2ee] hover:text-[#174b50]"}`}>{label}</Link>;
          })}
        </div>
      </nav>
    </header>
  );
}
