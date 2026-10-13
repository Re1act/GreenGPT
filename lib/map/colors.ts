// Color choices for every map layer. Every hex value here comes from the
// dataviz skill's validated reference palette (references/palette.md) — no
// eyeballed colors — with one deliberate, disclosed exception: drought uses the
// official US Drought Monitor convention instead of the palette's sequential
// ramp, because that color scheme is a recognized government/news-map standard
// or many users, and reinventing it in blue would cost recognizability for no
// accessibility gain (the USDM palette is itself designed for this exact use).
//
// Facility status is a 7-value nominal categorical field rendered as map points,
// which is an "all-pairs" context (any two pins can sit side by side) -- the
// palette's own docs note only its first three slots clear strict all-pairs CVD
// safety, so a 7-color assignment can't fully guarantee pairwise distinction by
// hue alone. The mitigation the skill prescribes for exactly this case (relief
// via secondary encoding) is applied: every status has a labeled legend swatch
// and appears again as text in the click popup, so identity is never
// color-only. All hexes are still drawn only from the documented set.
import type { DataDrivenPropertyValueSpecification, ExpressionSpecification } from "maplibre-gl";

export const FACILITY_STATUS_COLORS: Record<string, string> = {
  proposed: "#eda100", // categorical slot 4, yellow
  approved: "#2a78d6", // slot 1, blue
  under_construction: "#1baf7a", // slot 3, aqua
  operating: "#008300", // slot 6, green
  contested: "#eb6834", // slot 2, orange
  delayed: "#e87ba4", // slot 5, magenta
  cancelled: "#e34948", // slot 8, red
};

export const FACILITY_STATUS_LABELS: Record<string, string> = {
  proposed: "Proposed",
  approved: "Approved",
  under_construction: "Under construction",
  operating: "Operating",
  contested: "Contested",
  delayed: "Delayed",
  cancelled: "Cancelled",
};

export const facilityCircleColorExpression: DataDrivenPropertyValueSpecification<string> = [
  "match",
  ["get", "status"],
  "proposed",
  FACILITY_STATUS_COLORS.proposed,
  "approved",
  FACILITY_STATUS_COLORS.approved,
  "under_construction",
  FACILITY_STATUS_COLORS.under_construction,
  "operating",
  FACILITY_STATUS_COLORS.operating,
  "contested",
  FACILITY_STATUS_COLORS.contested,
  "delayed",
  FACILITY_STATUS_COLORS.delayed,
  "cancelled",
  FACILITY_STATUS_COLORS.cancelled,
  "#898781", // fallback: muted gray for any unrecognized status
];

// Official US Drought Monitor color convention (droughtmonitor.unl.edu) -- a
// recognized standard, used as-is rather than reinvented in the palette's blue.
export const DROUGHT_COLORS: Record<string, string> = {
  none: "#ffffff00", // transparent -- no drought is the map's default state, not a color to paint
  D0: "#ffff00",
  D1: "#fcd37f",
  D2: "#ffaa00",
  D3: "#e60000",
  D4: "#730000",
};

export const droughtFillColorExpression: DataDrivenPropertyValueSpecification<string> = [
  "match",
  ["get", "drought_level"],
  "none",
  DROUGHT_COLORS.none,
  "D0",
  DROUGHT_COLORS.D0,
  "D1",
  DROUGHT_COLORS.D1,
  "D2",
  DROUGHT_COLORS.D2,
  "D3",
  DROUGHT_COLORS.D3,
  "D4",
  DROUGHT_COLORS.D4,
  DROUGHT_COLORS.none,
];

// Sequential blue ramp, documented steps (palette.md), used for water stress
// (ordinal bucket on the WRI baseline_stress_score) and eGRID carbon intensity
// (continuous co2_lbs_per_mwh). Same ramp, two different domains.
const SEQ_150 = "#b7d3f6";
const SEQ_300 = "#6da7ec";
const SEQ_450 = "#2a78d6";
const SEQ_600 = "#184f95";
const SEQ_700 = "#0d366b";
const MUTED_GRAY = "#898781"; // documented "muted ink" -- used for unscored/no-data buckets

export const waterStressFillColorExpression: ExpressionSpecification = [
  "case",
  ["==", ["get", "baseline_stress_score"], null],
  MUTED_GRAY, // WRI's "Arid & low water use" basins have no numeric score
  [
    "step",
    ["get", "baseline_stress_score"],
    SEQ_150,
    1,
    SEQ_300,
    2,
    SEQ_450,
    3,
    SEQ_600,
    4,
    SEQ_700,
  ],
];

export const egridFillColorExpression: ExpressionSpecification = [
  "case",
  ["==", ["get", "co2_lbs_per_mwh"], null],
  MUTED_GRAY,
  [
    "interpolate",
    ["linear"],
    ["get", "co2_lbs_per_mwh"],
    200,
    SEQ_150,
    600,
    SEQ_300,
    1000,
    SEQ_450,
    1400,
    SEQ_600,
    1800,
    SEQ_700,
  ],
];

// Diverging blue <-> red pair (documented), gray neutral midpoint. Rather than
// invent extra light/dark steps for red (not in the documented palette), sign
// picks the hue and magnitude scales opacity -- a legitimate, simpler diverging
// encoding that only ever draws the three documented colors.
const DIVERGING_BLUE = "#2a78d6";
const DIVERGING_RED = "#e34948";
const DIVERGING_MIDPOINT = "#f0efec";

export const electricityPriceFillColorExpression: ExpressionSpecification = [
  "case",
  ["==", ["get", "pct_change_vs_2020"], null],
  MUTED_GRAY,
  [">", ["get", "pct_change_vs_2020"], 0],
  DIVERGING_RED,
  ["<", ["get", "pct_change_vs_2020"], 0],
  DIVERGING_BLUE,
  DIVERGING_MIDPOINT,
];

export const electricityPriceFillOpacityExpression: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["abs", ["case", ["==", ["get", "pct_change_vs_2020"], null], 0, ["get", "pct_change_vs_2020"]]],
  0,
  0.12,
  30,
  0.85,
];

export { MUTED_GRAY, SEQ_150, SEQ_300, SEQ_450, SEQ_600, SEQ_700, DIVERGING_BLUE, DIVERGING_RED, DIVERGING_MIDPOINT };

// Facility cluster bubbles (national-scale facility count made clustering a
// necessity -- see MapView.tsx). Reuses the same documented sequential blue
// ramp as water stress/eGRID rather than inventing a new color for "how many
// pins are under this bubble": it's a magnitude encoding like those, just of
// count instead of an environmental value.
export const clusterCircleColorExpression: ExpressionSpecification = [
  "step",
  ["get", "point_count"],
  SEQ_300,
  10,
  SEQ_450,
  100,
  SEQ_600,
  750,
  SEQ_700,
];

export const clusterCircleRadiusExpression: ExpressionSpecification = [
  "step",
  ["get", "point_count"],
  14,
  10,
  18,
  100,
  24,
  750,
  30,
];
