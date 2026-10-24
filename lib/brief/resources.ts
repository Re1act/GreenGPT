// Static, hand-checked reference links for the Local Brief. Anything here is a
// claim about the real world, so every entry records when it was checked.
// Organizations, including each state's utility commission, live in the
// database (public.organizations, loaded from data/organizations.json), not here.

/** NARUC's directory of every state utility commission. */
export const COMMISSION_DIRECTORY =
  "https://www.naruc.org/about-naruc/our-mission/state-associate-and-federal-members/";

/** USA.gov's lookup for state and local elected officials. */
export const OFFICIALS_DIRECTORY = "https://www.usa.gov/elected-officials";

export type Proceeding = {
  id: string; // docket number
  state: string;
  kind: string; // e.g. "Rate case", "Large-load tariff"
  title: string;
  utility: string;
  description: string;
  /** ISO date the public comment window closes, or null if not confirmed. */
  deadline: string | null;
  deadlineLabel: string;
  instructions: string;
  sourceDate: string;
  checked: string;
  source: string;
};

// Open utility proceedings with public comment windows. There's no national
// API for these (state commission dockets only), so each one is added by hand
// from the commission's own notice -- start with the pilot state.
export const PROCEEDINGS: Proceeding[] = [];
