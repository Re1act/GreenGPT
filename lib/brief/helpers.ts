// Pure display helpers for the Local Brief (no I/O; unit-tested).

const BILL_STATUS_LABELS: Record<string, string> = {
  introduced: "Introduced",
  in_committee: "In committee",
  passed_committee: "Passed committee",
  passed_chamber: "Passed one chamber",
  passed_legislature: "Passed the legislature",
  enacted: "Signed into law",
  vetoed: "Vetoed",
  failed: "Failed or withdrawn",
};

export function billStatusLabel(status: string): string {
  return BILL_STATUS_LABELS[status] ?? status;
}

const ORG_KIND_LABELS: Record<string, string> = {
  ratepayer_advocate: "Utility consumer advocate",
  utility_commission: "Utility regulator",
  local_government: "Local government",
  community_group: "Community group",
  environmental_group: "Environmental group",
  civic_group: "Civic group",
  industry_group: "Industry group",
  other: "Organization",
};

export function orgKindLabel(kind: string): string {
  return ORG_KIND_LABELS[kind] ?? "Organization";
}

/** Government channels, as opposed to groups with their own agenda. */
export function isOfficialChannel(kind: string): boolean {
  return kind === "ratepayer_advocate" || kind === "utility_commission";
}

/**
 * Why a ZIP can't get a brief, for ZIP ranges outside our coverage, or null.
 * The brief covers the 50 states, DC, and Puerto Rico (006/007/009): our county,
 * Senate, and Open States sources stop there. Military mail ZIPs (APO/FPO) have
 * no location at all.
 */
export function unsupportedZipReason(zip: string): string | null {
  if (/^(008|96799|969)/.test(zip)) {
    return "The Local Brief covers the 50 states, Washington, DC, and Puerto Rico. Other U.S. territories aren't covered yet.";
  }
  if (/^(09[0-8]|34[0-9]|96[2-6])/.test(zip)) {
    return "That's a military mail (APO/FPO) ZIP code, which has no physical location. Enter the ZIP code where you live.";
  }
  return null;
}

const DAY_MS = 86_400_000;

function formatDate(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

const FINAL_STATUSES = new Set(["enacted", "vetoed", "failed"]);
const STALE_AFTER_DAYS = 180;

/**
 * A warning for bills whose status may be out of date. Open States records what
 * happened, not what didn't: a bill left in committee when the session ended
 * still reads "In committee". After six months with no action, say so.
 */
export function staleBillNote(status: string, lastActionDate: string | null, today = new Date()): string | null {
  if (FINAL_STATUSES.has(status) || !lastActionDate) return null;
  const days = (today.getTime() - Date.parse(`${lastActionDate.slice(0, 10)}T00:00:00Z`)) / DAY_MS;
  if (days < STALE_AFTER_DAYS) return null;
  return `No recorded action since ${formatDate(lastActionDate)}. It may have died when the session ended.`;
}

/**
 * Where a comment window stands, in words. `today` is injectable for tests.
 * A deadline we haven't confirmed is never shown as open.
 */
export function deadlineState(deadline: string | null, checked: string, today = new Date()): string {
  if (!deadline) return `Deadline not confirmed (checked ${formatDate(checked)})`;
  // Whole calendar days between the reader's local date and the deadline date.
  const todayDate = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.round((Date.parse(`${deadline.slice(0, 10)}T00:00:00Z`) - todayDate) / DAY_MS);
  if (days < 0) return `Comment window closed ${formatDate(deadline)}`;
  if (days === 0) return `Comments due today (${formatDate(deadline)})`;
  return `Comments due ${formatDate(deadline)} (${days} day${days === 1 ? "" : "s"} left)`;
}

/**
 * Starting text for a public comment. Brackets mark everything the person must
 * fill in themselves: regulators and staff discount identical form letters, so
 * this is a skeleton for their own words, not a message to send as-is.
 */
export function commentTemplate(place: string, recipient: string, docket: string): string {
  return [
    `To: ${recipient || "[Commission, board, or legislator's office]"}`,
    `Re: ${docket || "[Docket, case, or bill number]"}`,
    "",
    `My name is [your name], and I live in ${place}.`,
    "",
    "I'm writing about [the specific data center project, rate case, or bill].",
    "",
    "How this affects me and my community: [your own experience, such as water, electricity bills, noise, land use, jobs, or local services].",
    "",
    "What I'm asking for: [the specific action you want, e.g. require the facility to cover the cost of new power lines, publish its expected water use, hold a public hearing].",
    "",
    "[Optional: evidence or sources that support your point.]",
    "",
    "Thank you for considering my comment.",
    "",
    "[Your name]",
    "[Your address, if the agency requires it]",
  ].join("\n");
}
