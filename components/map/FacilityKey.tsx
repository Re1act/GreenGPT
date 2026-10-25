import { FACILITY_STATUS_COLORS, FACILITY_STATUS_LABELS } from "@/lib/map/colors";

export default function FacilityKey() {
  return (
    <aside aria-label="Facility map key" className="pointer-events-none absolute bottom-16 left-3 z-10 w-48 sm:bottom-12 rounded-lg border border-white/15 bg-zinc-800/60 p-3 text-zinc-100 shadow-sm">
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
      {/* Hard constraint from the project brief, stated in the UI rather than a
          footnote: this map cannot and does not claim to trace any request to
          a facility. Inference routing is dynamic and undisclosed by every
          provider -- any tool claiming otherwise is fabricating. */}
      <p className="mt-3 border-t border-white/15 pt-2 text-[0.6875rem] leading-snug text-zinc-200">
        Shows where facilities are being built, not which facility served any specific request.
      </p>
    </aside>
  );
}
