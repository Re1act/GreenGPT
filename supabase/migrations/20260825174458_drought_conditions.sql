-- Current drought overlay: NIDIS / US Drought Monitor, refreshed weekly at county
-- granularity (the Drought Monitor's finest routinely-published unit). One row per
-- county per publication week; history is kept (not overwritten in place) so the map
-- can show "as of <date>" honestly and so we can chart drought trends later if needed.
create type public.drought_level as enum (
  'none',
  'D0',  -- abnormally dry
  'D1',  -- moderate drought
  'D2',  -- severe drought
  'D3',  -- extreme drought
  'D4'   -- exceptional drought
);

create table if not exists public.drought_conditions (
  id uuid primary key default gen_random_uuid(),
  county_fips text not null references public.counties (fips),
  drought_level public.drought_level not null,
  as_of_date date not null,              -- Drought Monitor publication (Thursday) date
  source text not null default 'NIDIS / US Drought Monitor',

  created_at timestamptz not null default now(),
  unique (county_fips, as_of_date)
);

create index if not exists drought_conditions_asof_idx on public.drought_conditions (as_of_date desc);
create index if not exists drought_conditions_county_idx on public.drought_conditions (county_fips);

comment on table public.drought_conditions is 'Weekly county-level US Drought Monitor readings. Query the latest as_of_date per county for current conditions; history retained for trend context.';
