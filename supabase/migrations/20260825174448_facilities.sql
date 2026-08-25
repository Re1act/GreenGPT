-- Facilities: the core map/brief entity. Manually curated (no authoritative public
-- registry exists per the brief), so every row carries its own citation rather than
-- relying on a single global source note.
--
-- Design decision: "operating / under-construction / proposed" (map base state) and
-- "approved / contested / delayed / cancelled" (opposition overlay) are modeled as one
-- lifecycle enum rather than two independent dimensions. In practice a project is in
-- exactly one of these states at a time in the sources we're curating from (Data
-- Center Watch, local reporting) -- "contested" and "delayed" supersede "proposed" or
-- "under_construction" rather than layering on top of them. Revisit if curation turns
-- up cases that need both a base state and an independent opposition flag.
create type public.facility_status as enum (
  'proposed',
  'approved',
  'contested',
  'delayed',
  'under_construction',
  'operating',
  'cancelled'
);

-- Matches the simulator's cooling architecture vocabulary (see coefficients config)
-- so a facility can be one-click loaded into the simulator with a real starting input.
create type public.cooling_type as enum (
  'evaporative',
  'closed_loop',
  'air',
  'immersion'
);

create table if not exists public.facilities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  operator text,
  location extensions.geography(Point, 4326) not null,
  state text not null,
  county_fips text references public.counties (fips),

  status public.facility_status not null default 'proposed',
  announced_load_mw numeric,
  cooling_type public.cooling_type,        -- null = undisclosed
  power_source text,                       -- free text: disclosure is inconsistent, avoid a rejecting enum
  build_year integer,

  applicable_local_policy text,            -- e.g. "Chandler cap: 115 gal/day per 1,000 sqft"
  opposition_note text,                    -- free text detail when status is contested/delayed/cancelled

  source_name text not null,               -- e.g. "Data Center Watch", "county planning docs"
  source_url text,
  source_date date not null,               -- date the cited figures were true as of
  curated_by text,                         -- who/what entered this row, for audit trail
  confidence text,                         -- e.g. "confirmed", "reported", "rumored"

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists facilities_location_idx on public.facilities using gist (location);
create index if not exists facilities_state_idx on public.facilities (state);
create index if not exists facilities_status_idx on public.facilities (status);

comment on table public.facilities is 'Operating/under-construction/proposed data center facilities. Manually curated; no authoritative public registry exists (brief section 6).';
comment on column public.facilities.confidence is 'Curation confidence, since facility load/cooling data is frequently undisclosed or third-hand.';
