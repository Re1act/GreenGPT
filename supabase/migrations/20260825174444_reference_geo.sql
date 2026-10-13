-- Reference geography: counties and zip centroids.
--
-- Design decision: zip -> lat/lon is served from a locally seeded table rather than
-- calling the Census Geocoder API on every request. The brief specifies Census
-- Geocoder for zip -> congressional district (a v1 feature, representative lookup).
-- For the MVP "nearby facilities" radius query we need fast, rate-limit-free,
-- offline-capable centroid lookups, so we seed this table once from the free
-- Census Gazetteer ZCTA file and refresh it rarely (zip boundaries barely change).
-- The same table's `state` column also drives the state-legislation join for the
-- Local Brief, without a second lookup.
create table if not exists public.counties (
  fips text primary key,                 -- 5-digit county FIPS code
  name text not null,
  state text not null,                   -- 2-letter USPS state code
  geom extensions.geography(MultiPolygon, 4326),
  updated_at timestamptz not null default now()
);

create index if not exists counties_state_idx on public.counties (state);
create index if not exists counties_geom_idx on public.counties using gist (geom);

create table if not exists public.zip_centroids (
  zip text primary key,                  -- 5-digit ZCTA
  state text not null,
  county_fips text references public.counties (fips),
  location extensions.geography(Point, 4326) not null,
  source text not null default 'Census Gazetteer ZCTA',
  updated_at timestamptz not null default now()
);

create index if not exists zip_centroids_state_idx on public.zip_centroids (state);
create index if not exists zip_centroids_location_idx on public.zip_centroids using gist (location);

comment on table public.counties is 'Reference geometry for county-level overlays (drought conditions). Seeded from Census TIGER, refreshed rarely.';
comment on table public.zip_centroids is 'Static zip -> lat/lon/state/county lookup seeded from Census Gazetteer, used for the Local Brief radius query and state resolution.';
