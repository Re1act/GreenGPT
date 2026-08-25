-- RPC backing the Local Brief's "facilities within a chosen radius" feature and the
-- map's zip-search box. Resolves the zip via the seeded zip_centroids table (no
-- external API call on the request path) and does the radius query in PostGIS.
create or replace function public.facilities_within_radius(
  p_zip text,
  p_radius_miles numeric default 50
)
returns table (
  id uuid,
  name text,
  operator text,
  status public.facility_status,
  announced_load_mw numeric,
  cooling_type public.cooling_type,
  state text,
  distance_miles numeric,
  lat double precision,
  lon double precision
)
language sql
stable
as $$
  select
    f.id,
    f.name,
    f.operator,
    f.status,
    f.announced_load_mw,
    f.cooling_type,
    f.state,
    round((extensions.ST_Distance(f.location, z.location) / 1609.34)::numeric, 1) as distance_miles,
    extensions.ST_Y(f.location::extensions.geometry) as lat,
    extensions.ST_X(f.location::extensions.geometry) as lon
  from public.facilities f
  join public.zip_centroids z on z.zip = p_zip
  where extensions.ST_DWithin(f.location, z.location, p_radius_miles * 1609.34)
  order by extensions.ST_Distance(f.location, z.location);
$$;

comment on function public.facilities_within_radius is 'Facilities within p_radius_miles of a zip centroid, nearest first. Powers the Local Brief and map zip search.';

-- Convenience RPC: resolve a zip straight to its state, for the state-legislation
-- half of the Local Brief (no separate Census Geocoder call needed for MVP).
create or replace function public.state_for_zip(p_zip text)
returns text
language sql
stable
as $$
  select state from public.zip_centroids where zip = p_zip;
$$;
