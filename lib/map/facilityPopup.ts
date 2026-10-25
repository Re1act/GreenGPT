import { FACILITY_STATUS_LABELS } from "@/lib/map/colors";
import { facilityScenarioHref } from "@/lib/simulator/params";

// Facility properties come straight from facilities_geojson() (see
// supabase/migrations/20260825181942_map_geojson_rpcs.sql) -- curated data, but
// still rendered as HTML via MapLibre's Popup.setHTML, so every value is
// escaped. Never trust curated text as safe markup.
function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function row(label: string, value: string | null | undefined) {
  if (!value) return "";
  return `<div class="kilowatch-popup-row"><span class="kilowatch-popup-label">${escapeHtml(
    label
  )}</span><span>${escapeHtml(value)}</span></div>`;
}

export type FacilityProperties = {
  name: string;
  operator: string | null;
  status: string;
  announced_load_mw: number | null;
  cooling_type: string | null;
  power_source: string | null;
  build_year: number | null;
  state: string;
  applicable_local_policy: string | null;
  opposition_note: string | null;
  source_name: string;
  source_url: string | null;
  source_date: string;
  confidence: string | null;
};

// Per the brief's hard constraint (section B): this is a curated record about a
// facility, never a claim about which facility served any user's request. That
// framing lives in the page copy, not per-popup, but nothing here should ever
// imply otherwise.
export function buildFacilityPopupHtml(p: FacilityProperties, coords: [number, number]): string {
  const statusLabel = FACILITY_STATUS_LABELS[p.status] ?? p.status;
  const coolingLabel = p.cooling_type
    ? p.cooling_type.replace("_", "-").replace(/\b\w/g, (c) => c.toUpperCase())
    : "Undisclosed";
  // Hands the simulator only what this record discloses; it fills the rest
  // with defaults and says so (see lib/simulator/params.ts).
  const simulateHref = facilityScenarioHref({
    name: p.name,
    lon: coords[0],
    lat: coords[1],
    announcedLoadMW: p.announced_load_mw,
    coolingType: p.cooling_type,
    buildYear: p.build_year,
  });

  return `
    <div class="kilowatch-popup">
      <h3 class="kilowatch-popup-title">${escapeHtml(p.name)}</h3>
      ${row("Operator", p.operator ?? "Undisclosed")}
      ${row("Status", statusLabel)}
      ${row("Announced load", p.announced_load_mw ? `${p.announced_load_mw} MW` : "Undisclosed")}
      ${row("Cooling", coolingLabel)}
      ${row("Build year", p.build_year ? String(p.build_year) : null)}
      ${row("State", p.state)}
      ${p.applicable_local_policy ? `<p class="kilowatch-popup-note">${escapeHtml(p.applicable_local_policy)}</p>` : ""}
      ${p.opposition_note ? `<p class="kilowatch-popup-note kilowatch-popup-note--opposition">${escapeHtml(p.opposition_note)}</p>` : ""}
      <a class="kilowatch-popup-simulate" href="${escapeHtml(simulateHref)}">Model this site in the simulator →</a>
      <div class="kilowatch-popup-source">
        Source: ${
          p.source_url
            ? `<a href="${escapeHtml(p.source_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(
                p.source_name
              )}</a>`
            : escapeHtml(p.source_name)
        } (${escapeHtml(p.source_date)})
        ${p.confidence ? `<div class="kilowatch-popup-confidence">${escapeHtml(p.confidence)}</div>` : ""}
      </div>
    </div>
  `;
}
