-- Water stress overlay: WRI Aqueduct basin-level baseline water stress. This is a
-- slow-changing reference layer (WRI updates it on the order of years, not weeks), so
-- it is ingested and versioned rather than refreshed on every request.
create table if not exists public.water_stress_basins (
  id uuid primary key default gen_random_uuid(),
  basin_name text not null,
  aqueduct_id text unique,               -- WRI Aqueduct's own basin identifier, for re-ingestion upserts
  geom extensions.geography(MultiPolygon, 4326) not null,
  baseline_stress_score numeric,         -- WRI's raw score
  baseline_stress_category text not null, -- WRI's label, e.g. "Low", "Medium-High", "Extremely High"
  source text not null default 'WRI Aqueduct Water Risk Atlas',
  source_version text,                   -- WRI dataset release version/date
  updated_at timestamptz not null default now()
);

create index if not exists water_stress_basins_geom_idx on public.water_stress_basins using gist (geom);

comment on table public.water_stress_basins is 'WRI Aqueduct basin-level baseline water stress, for the map''s water stress overlay.';
