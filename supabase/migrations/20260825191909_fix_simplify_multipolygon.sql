-- Fix a regression from the previous migration: ST_SimplifyPreserveTopology can
-- collapse a MultiPolygon down to a single Polygon when simplification reduces it
-- to one effective part. The strict `geography(MultiPolygon,4326)` column type
-- then rejects the row ("Geometry type (Polygon) does not match column type
-- (MultiPolygon)"). Wrapping ST_Multi() around the *simplified* result (not just
-- the input, which was already wrapped) forces it back to MultiPolygon
-- regardless of what simplification produces. This broke ~97% of the counties
-- re-ingestion and ~63% of the water_stress re-ingestion before being caught by
-- re-running both after the previous migration and checking the failure counts.

create or replace function public.upsert_county(
  p_fips text,
  p_name text,
  p_state text,
  p_geojson jsonb
)
returns void
language sql
as $$
  insert into public.counties (fips, name, state, geom, updated_at)
  values (
    p_fips,
    p_name,
    p_state,
    extensions.ST_Multi(
      extensions.ST_SimplifyPreserveTopology(
        extensions.ST_SetSRID(extensions.ST_Multi(extensions.ST_GeomFromGeoJSON(p_geojson::text)), 4326),
        0.01
      )
    )::extensions.geography,
    now()
  )
  on conflict (fips) do update set
    name = excluded.name,
    state = excluded.state,
    geom = excluded.geom,
    updated_at = now();
$$;

create or replace function public.upsert_water_stress_basin(
  p_aqueduct_id text,
  p_basin_name text,
  p_geojson jsonb,
  p_score numeric,
  p_category text,
  p_version text
)
returns void
language sql
as $$
  insert into public.water_stress_basins
    (aqueduct_id, basin_name, geom, baseline_stress_score, baseline_stress_category, source_version, updated_at)
  values (
    p_aqueduct_id,
    p_basin_name,
    extensions.ST_Multi(
      extensions.ST_SimplifyPreserveTopology(
        extensions.ST_SetSRID(extensions.ST_Multi(extensions.ST_GeomFromGeoJSON(p_geojson::text)), 4326),
        0.01
      )
    )::extensions.geography,
    p_score,
    p_category,
    p_version,
    now()
  )
  on conflict (aqueduct_id) do update set
    basin_name = excluded.basin_name,
    geom = excluded.geom,
    baseline_stress_score = excluded.baseline_stress_score,
    baseline_stress_category = excluded.baseline_stress_category,
    source_version = excluded.source_version,
    updated_at = now();
$$;

revoke execute on function public.upsert_county(text, text, text, jsonb) from public;
revoke execute on function public.upsert_water_stress_basin(text, text, jsonb, numeric, text, text) from public;
grant execute on function public.upsert_county(text, text, text, jsonb) to service_role;
grant execute on function public.upsert_water_stress_basin(text, text, jsonb, numeric, text, text) to service_role;
