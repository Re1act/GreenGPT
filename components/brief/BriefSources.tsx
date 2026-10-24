import type { Brief } from "@/lib/brief/types";
import { COMMISSION_DIRECTORY, OFFICIALS_DIRECTORY, PROCEEDINGS } from "@/lib/brief/resources";

type Citation = { title: string; url: string };
function unique(items: Citation[]) {
  return [...new Map(items.map(item => [item.url, item])).values()];
}

export default function BriefSources({ brief }: { brief: Brief | null }) {
  const state = brief?.place.state;
  const orgs = brief?.organizations.items ?? [];
  const commissions = orgs.filter(o => o.kind === "utility_commission");
  const groups: { title: string; description: string; links: Citation[] }[] = [
    { title: "ZIP codes & nearby facilities", description: "ZIP coordinates locate the search area. Individual facility records link to their underlying reporting and source dates.", links: [
      { title: "U.S. Census Bureau — ZIP Code Tabulation Area gazetteer", url: "https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.html" },
      { title: "Zippopotam.us / GeoNames — fallback ZIP locations", url: "https://www.zippopotam.us/" },
      ...unique((brief?.facilities.items ?? []).flatMap(f => f.source_url ? [{ title: `${f.source_name || "Facility record"} · ${f.name}`, url: f.source_url }] : [])),
    ] },
    { title: "State legislation", description: "Bill records provide sponsors, legislative actions, and source summaries. Check the legislature’s record for the latest status.", links: [
      { title: state ? `Open States — ${brief!.place.stateName} bills` : "Open States — state bill search", url: state ? `https://openstates.org/${state.toLowerCase()}/bills/` : "https://openstates.org/" },
      ...unique((brief?.bills.items ?? []).map(b => ({ title: `${b.number} — ${b.title}`, url: b.source }))),
    ] },
    { title: "Utility proceedings & deadlines", description: "Commission notices are the source for docket numbers, comment windows, and filing instructions. Coverage here is limited.", links: [
      { title: "NARUC — state utility commission directory", url: COMMISSION_DIRECTORY },
      ...commissions.map(c => ({ title: `${c.name} (checked ${c.checked})`, url: c.website })),
      ...PROCEEDINGS.filter(p => p.state === state).map(p => ({ title: `${p.id} — official notice (checked ${p.checked})`, url: p.source })),
    ] },
    { title: "Elected representatives", description: "Official directories and contact pages help confirm who represents you. House and state districts require an address check.", links: [
      { title: "U.S. Senate — senator directory", url: "https://www.senate.gov/senators/senators-contact.htm" },
      { title: "Open States — find your state legislators", url: "https://openstates.org/find_your_legislator/" },
      { title: "U.S. House — find your representative", url: "https://www.house.gov/representatives/find-your-representative" },
      { title: "USA.gov — state and local elected officials", url: OFFICIALS_DIRECTORY },
      ...unique((brief?.officials.items ?? []).map(o => ({ title: `${o.name} — ${o.role}`, url: o.url }))),
    ] },
    { title: "Community organizations", description: "Organizations describe their own work and priorities. Directory links are starting points, not endorsements or confirmed local campaigns.", links: [
      ...unique(orgs.filter(o => o.kind !== "utility_commission").map(o => ({ title: `${o.name} (checked ${o.checked})`, url: o.website }))),
      { title: "NASUCA — state utility consumer advocates", url: "https://www.nasuca.org/members/" },
      { title: "Sierra Club — local chapter directory", url: "https://www.sierraclub.org/chapters" },
    ] },
  ];
  return <section aria-labelledby="brief-sources-title" className="mt-10 border-t border-[#cadbd5] pt-8">
    <p className="home-eyebrow">Behind the brief</p>
    <h2 id="brief-sources-title" className="mt-2 text-2xl font-semibold tracking-tight text-[#174b50]">Sources & further reading</h2>
    <p className="mt-3 max-w-3xl">A reference shelf for the information in your brief. {brief ? "Links below include the records returned for your ZIP code." : "Search a ZIP code to add the specific facility, bill, and community sources for your area."}</p>
    <div className="mt-6 grid items-start gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
      {groups.map(group => <div key={group.title} className="min-w-0 border-t border-[#d4e1db] pt-4">
        <h3 className="font-semibold text-[#174b50]">{group.title}</h3>
        <p className="mt-2 text-xs leading-5">{group.description}</p>
        <ul className="mt-3 space-y-2 text-xs leading-5">
          {group.links.slice(0, 4).map(link => <li key={link.url}><a href={link.url} target="_blank" rel="noreferrer" className="text-[#236973] underline decoration-[#adc7c5] underline-offset-4 hover:decoration-current">{link.title} ↗</a></li>)}
        </ul>
        {group.links.length > 4 && <details className="mt-3 text-xs leading-5"><summary className="cursor-pointer font-medium text-[#236973]">View {group.links.length - 4} more sources</summary><ul className="mt-3 space-y-2">{group.links.slice(4).map(link => <li key={link.url}><a href={link.url} target="_blank" rel="noreferrer" className="text-[#236973] underline underline-offset-4">{link.title} ↗</a></li>)}</ul></details>}
      </div>)}
    </div>
    <p className="mt-7 border-t border-[#d4e1db] pt-4 text-xs leading-5">Source dates and coverage notes appear with the results. Records can change; confirm current project status and filing deadlines at the linked source.</p>
  </section>;
}
