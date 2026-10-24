// Shape of the Local Brief returned by /api/brief. Every section carries
// `available` and a `note`: an unavailable source is reported as a coverage
// gap, never as an empty result that reads like "nothing found".

export type Place = {
  zip: string;
  /** Human label for the area, e.g. "Maricopa County, AZ" or "Chandler, AZ". */
  label: string;
  state: string;
  stateName: string;
  countyFips: string | null;
  countyName: string | null;
  lat: number;
  lon: number;
  /** Where the ZIP's location came from. */
  source: "census" | "geocoder";
};

export type Section<T> = { items: T[]; available: boolean; note: string };

export type BriefFacility = {
  id: string;
  name: string;
  operator: string | null;
  status: string | null;
  announced_load_mw: number | null;
  distance: number;
  source_name: string | null;
  source_url: string | null;
  source_date: string | null;
  mapHref: string;
  simulateHref: string;
};

export type BriefBill = {
  id: string;
  number: string;
  title: string;
  session: string;
  sponsor: string;
  status: string;
  summary: string;
  /** Tells the reader whether `summary` is an official abstract or just the title. */
  summaryKind: string;
  /** Set when an open bill hasn't moved in months, so "In committee" isn't taken at face value. */
  staleNote: string | null;
  updated: string;
  source: string;
};

export type Official = {
  name: string;
  role: string;
  /** True when matched from the ZIP's single point, which can miss district lines. */
  approximate: boolean;
  phone: string | null;
  url: string;
};

export type BriefOrganization = {
  id: string;
  name: string;
  kind: string;
  kindLabel: string;
  /** A government office (regulator or consumer advocate) rather than an advocacy group. */
  official: boolean;
  website: string;
  description: string;
  statedPosition: string | null;
  scope: string;
  source: string;
  checked: string;
};

export type Brief = {
  place: Place;
  radius: number;
  generatedAt: string;
  facilities: Section<BriefFacility>;
  bills: Section<BriefBill>;
  officials: Section<Official>;
  organizations: Section<BriefOrganization>;
};
