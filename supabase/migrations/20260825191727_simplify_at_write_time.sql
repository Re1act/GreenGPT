-- Fix: water_stress_geojson() was timing out under the anon role's statement
-- timeout in production testing. Root cause: ST_SimplifyPreserveTopology was
-- running over all 2,203 basin polygons on every request (the original design in
-- 20260825181942_map_geojson_rpcs.sql), instead of once at ingestion. Counties
-- (3,221 rows, used by drought_geojson) had the same problem and were simply
-- lucky not to time out yet -- egrid_subregions was already fine because that
-- ingestion script simplified client-side with @turf/simplify before upload.
--
-- Fix: simplify once when a row is written (in the upsert RPCs), store the
-- simplified geometry, and make the read RPCs just serialize it directly. This
-- also shrinks storage and every future read, not just the timed-out one.

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
    extensions.ST_SimplifyPreserveTopology(
      extensions.ST_SetSRID(extensions.ST_Multi(extensions.ST_GeomFromGeoJSON(p_geojson::text)), 4326),
      0.01
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
    extensions.ST_SimplifyPreserveTopology(
      extensions.ST_SetSRID(extensions.ST_Multi(extensions.ST_GeomFromGeoJSON(p_geojson::text)), 4326),
      0.01
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

-- Read RPCs no longer simplify (geometry is now pre-simplified at write time).
create or replace function public.water_stress_geojson()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'type', 'FeatureCollection',
    'features', coalesce(jsonb_agg(
      jsonb_build_object(
        'type', 'Feature',
        'geometry', extensions.ST_AsGeoJSON(w.geom::extensions.geometry)::jsonb,
        'properties', jsonb_build_object(
          'basin_name', w.basin_name,
          'baseline_stress_score', w.baseline_stress_score,
          'baseline_stress_category', w.baseline_stress_category,
          'source_version', w.source_version
        )
      )
    ), '[]'::jsonb)
  )
  from public.water_stress_basins w;
$$;

create or replace function public.drought_geojson()
returns jsonb
language sql
stable
as $$
  with latest as (
    select distinct on (county_fips) county_fips, drought_level, as_of_date
    from public.drought_conditions
    order by county_fips, as_of_date desc
  )
  select jsonb_build_object(
    'type', 'FeatureCollection',
    'features', coalesce(jsonb_agg(
      jsonb_build_object(
        'type', 'Feature',
        'geometry', extensions.ST_AsGeoJSON(c.geom::extensions.geometry)::jsonb,
        'properties', jsonb_build_object(
          'county_fips', c.fips,
          'county_name', c.name,
          'state', c.state,
          'drought_level', l.drought_level,
          'as_of_date', l.as_of_date
        )
      )
    ), '[]'::jsonb)
  )
  from latest l
  join public.counties c on c.fips = l.county_fips;
$$;

create or replace function public.egrid_geojson()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'type', 'FeatureCollection',
    'features', coalesce(jsonb_agg(
      jsonb_build_object(
        'type', 'Feature',
        'geometry', extensions.ST_AsGeoJSON(e.geom::extensions.geometry)::jsonb,
        'properties', jsonb_build_object(
          'subregion_code', e.subregion_code,
          'name', e.name,
          'co2_lbs_per_mwh', e.co2_lbs_per_mwh,
          'source_year', e.source_year
        )
      )
    ), '[]'::jsonb)
  )
  from public.egrid_subregions e;
$$;

grant execute on function public.water_stress_geojson() to anon, authenticated;
grant execute on function public.drought_geojson() to anon, authenticated;
grant execute on function public.egrid_geojson() to anon, authenticated;
