-- Two overlay layers from the map brief (grid carbon intensity, electricity price
-- change) had no tables yet -- caught while scoping the map implementation.
-- Both are effectively static/annual reference geometry plus a small time series,
-- so they're modeled as reference boundary + fact table pairs, same pattern as
-- counties + drought_conditions.

create table if not exists public.states (
  state text primary key,                -- 2-letter USPS code
  name text not null,
  geom extensions.geography(MultiPolygon, 4326) not null,
  source text not null default 'Census cartographic boundary files',
  updated_at timestamptz not null default now()
);

create index if not exists states_geom_idx on public.states using gist (geom);

comment on table public.states is 'State boundary reference geometry, used by the electricity price overlay and any other state-level choropleth.';

-- Grid carbon intensity overlay: EPA eGRID subregion boundaries + emission factor.
-- Subregion boundaries are approximate and can cross state lines (EPA's own caveat),
-- so this is real subregion geometry, not a state-level approximation.
create table if not exists public.egrid_subregions (
  subregion_code text primary key,       -- eGRID acronym, e.g. 'AZNM', 'RFCW'
  name text not null,
  geom extensions.geography(MultiPolygon, 4326) not null,
  co2_lbs_per_mwh numeric not null,
  source text not null default 'EPA eGRID',
  source_year integer not null,
  updated_at timestamptz not null default now()
);

create index if not exists egrid_subregions_geom_idx on public.egrid_subregions using gist (geom);

comment on table public.egrid_subregions is 'EPA eGRID subregion boundaries and CO2 emission factors, for the map''s grid carbon intensity overlay and the simulator''s eGRID_subregion_intensity coefficient.';

-- Electricity price change overlay: EIA Form 861 state-level annual average
-- residential price, indexed to 2020 per the brief. History is kept per (state, year)
-- so "indexed to 2020" can be computed or re-based without re-ingesting.
create table if not exists public.electricity_prices (
  id uuid primary key default gen_random_uuid(),
  state text not null references public.states (state),
  year integer not null,
  avg_price_cents_per_kwh numeric not null,
  source text not null default 'EIA Form 861',

  created_at timestamptz not null default now(),
  unique (state, year)
);

create index if not exists electricity_prices_state_idx on public.electricity_prices (state, year);

comment on table public.electricity_prices is 'EIA Form 861 state-level annual average residential electricity price. Index to 2020 is computed at query time (year=2020 row as the base), not stored, so re-basing never requires re-ingestion.';

grant select on public.states, public.egrid_subregions, public.electricity_prices to anon, authenticated;
