"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// The brief's loop -- understand -> locate -> act -- is the nav order.
const LINKS = [
  { href: "/simulate", label: "Simulator", step: "Understand" },
  { href: "/map", label: "Map", step: "Locate" },
  { href: "/brief", label: "Local brief", step: "Act" },
];

export default function SiteNav() {
  const pathname = usePathname();

  return (
    <nav className="z-30 flex shrink-0 items-center gap-1 overflow-x-auto border-b border-black/10 bg-white px-4 dark:border-white/10 dark:bg-zinc-950">
      <Link
        href="/"
        className="mr-3 py-2.5 text-sm font-semibold text-emerald-800 dark:text-emerald-400"
      >
        GreenGPT
      </Link>
      {LINKS.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-baseline gap-1.5 whitespace-nowrap border-b-2 px-2.5 py-2.5 text-sm transition-colors ${
              active
                ? "border-zinc-900 font-medium text-zinc-900 dark:border-zinc-100 dark:text-zinc-50"
                : "border-transparent text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            {link.label}
            <span className="hidden text-[11px] text-zinc-400 sm:inline dark:text-zinc-500">
              {link.step}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
