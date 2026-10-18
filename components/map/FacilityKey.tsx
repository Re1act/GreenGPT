import { FACILITY_STATUS_COLORS, FACILITY_STATUS_LABELS } from "@/lib/map/colors";

export default function FacilityKey() {
  return (
    <aside aria-label="Facility map key" className="pointer-events-none absolute bottom-12 left-3 z-10 w-44 rounded-lg border border-white/15 bg-zinc-800/60 p-3 text-zinc-100 shadow-sm">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide">Facility key</h2>
      <ul className="space-y-1.5">
        {Object.entries(FACILITY_STATUS_LABELS).map(([status, label]) => (
          <li key={status} className="flex items-center gap-2 text-xs">
            <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full border border-black/10"
              style={{ backgroundColor: FACILITY_STATUS_COLORS[status] }} />
            {label}
          </li>
        ))}
      </ul>
    </aside>
  );
}
