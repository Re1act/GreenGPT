-- Upsert RPCs for every ingested table. These do the ST_GeomFromGeoJSON / ST_Multi /
-- ST_MakePoint work server-side so ingestion scripts (one-off seeds today, scheduled
-- Vercel Cron / GitHub Actions jobs later per the brief's architecture) can just POST
-- plain GeoJSON/scalars instead of hand-building WKT. This is the one interface both
-- the initial seed scripts and future recurring ingestion jobs share.
--
-- Security: Postgres grants EXECUTE on new functions to PUBLIC by default -- unlike
-- tables, which is why the earlier grant_public_read migration only needed to ADD
-- read grants. Here we need the opposite: explicitly REVOKE the default PUBLIC
-- execute grant so anon/authenticated (which inherit from PUBLIC) cannot call these
-- mutation RPCs, and grant only to service_role, which ingestion scripts authenticate
-- as. Missing this revoke would have been a real write-access hole.

create or replace function public.upsert_state(
  p_state text,
  p_name text,
  p_geojson jsonb,
  p_source text default 'Census cartographic boundary files'
)
returns void
language sql
as $$
  insert into public.states (state, name, geom, source, updated_at)
  values (
    p_state,
    p_name,
    extensions.ST_SetSRID(extensions.ST_Multi(extensions.ST_GeomFromGeoJSON(p_geojson::text)), 4326)::extensions.geography,
    p_source,
    now()
  )
  on conflict (state) do update set
    name = excluded.name,
    geom = excluded.geom,
    source = excluded.source,
    updated_at = now();
$$;

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
    extensions.ST_SetSRID(extensions.ST_Multi(extensions.ST_GeomFromGeoJSON(p_geojson::text)), 4326)::extensions.geography,
    now()
  )
  on conflict (fips) do update set
    name = excluded.name,
    state = excluded.state,
    geom = excluded.geom,
    updated_at = now();
$$;

create or replace function public.upsert_zip_centroid(
  p_zip text,
  p_state text,
  p_county_fips text,
  p_lon double precision,
  p_lat double precision
)
returns void
language sql
as $$
  insert into public.zip_centroids (zip, state, county_fips, location, updated_at)
  values (
    p_zip,
    p_state,
    p_county_fips,
    extensions.ST_SetSRID(extensions.ST_MakePoint(p_lon, p_lat), 4326)::extensions.geography,
    now()
  )
  on conflict (zip) do update set
    state = excluded.state,
    county_fips = excluded.county_fips,
    location = excluded.location,
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
    extensions.ST_SetSRID(extensions.ST_Multi(extensions.ST_GeomFromGeoJSON(p_geojson::text)), 4326)::extensions.geography,
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

create or replace function public.upsert_egrid_subregion(
  p_code text,
  p_name text,
  p_geojson jsonb,
  p_co2_lbs_per_mwh numeric,
  p_year integer
)
returns void
language sql
as $$
  insert into public.egrid_subregions
    (subregion_code, name, geom, co2_lbs_per_mwh, source_year, updated_at)
  values (
    p_code,
    p_name,
    extensions.ST_SetSRID(extensions.ST_Multi(extensions.ST_GeomFromGeoJSON(p_geojson::text)), 4326)::extensions.geography,
    p_co2_lbs_per_mwh,
    p_year,
    now()
  )
  on conflict (subregion_code) do update set
    name = excluded.name,
    geom = excluded.geom,
    co2_lbs_per_mwh = excluded.co2_lbs_per_mwh,
    source_year = excluded.source_year,
    updated_at = now();
$$;

create or replace function public.upsert_drought_condition(
  p_county_fips text,
  p_level public.drought_level,
  p_as_of date
)
returns void
language sql
as $$
  insert into public.drought_conditions (county_fips, drought_level, as_of_date)
  values (p_county_fips, p_level, p_as_of)
  on conflict (county_fips, as_of_date) do update set
    drought_level = excluded.drought_level;
$$;

create or replace function public.upsert_electricity_price(
  p_state text,
  p_year integer,
  p_price numeric
)
returns void
language sql
as $$
  insert into public.electricity_prices (state, year, avg_price_cents_per_kwh)
  values (p_state, p_year, p_price)
  on conflict (state, year) do update set
    avg_price_cents_per_kwh = excluded.avg_price_cents_per_kwh;
$$;

create or replace function public.upsert_facility(
  p_id uuid,
  p_name text,
  p_operator text,
  p_lon double precision,
  p_lat double precision,
  p_state text,
  p_county_fips text,
  p_status public.facility_status,
  p_announced_load_mw numeric,
  p_cooling_type public.cooling_type,
  p_power_source text,
  p_build_year integer,
  p_applicable_local_policy text,
  p_opposition_note text,
  p_source_name text,
  p_source_url text,
  p_source_date date,
  p_curated_by text,
  p_confidence text
)
returns void
language sql
as $$
  insert into public.facilities (
    id, name, operator, location, state, county_fips, status, announced_load_mw,
    cooling_type, power_source, build_year, applicable_local_policy, opposition_note,
    source_name, source_url, source_date, curated_by, confidence, updated_at
  )
  values (
    coalesce(p_id, gen_random_uuid()), p_name, p_operator,
    extensions.ST_SetSRID(extensions.ST_MakePoint(p_lon, p_lat), 4326)::extensions.geography,
    p_state, p_county_fips, p_status, p_announced_load_mw, p_cooling_type, p_power_source,
    p_build_year, p_applicable_local_policy, p_opposition_note, p_source_name, p_source_url,
    p_source_date, p_curated_by, p_confidence, now()
  )
  on conflict (id) do update set
    name = excluded.name, operator = excluded.operator, location = excluded.location,
    state = excluded.state, county_fips = excluded.county_fips, status = excluded.status,
    announced_load_mw = excluded.announced_load_mw, cooling_type = excluded.cooling_type,
    power_source = excluded.power_source, build_year = excluded.build_year,
    applicable_local_policy = excluded.applicable_local_policy, opposition_note = excluded.opposition_note,
    source_name = excluded.source_name, source_url = excluded.source_url,
    source_date = excluded.source_date, curated_by = excluded.curated_by,
    confidence = excluded.confidence, updated_at = now();
$$;

create or replace function public.log_ingestion_run(
  p_source_name text,
  p_started_at timestamptz,
  p_finished_at timestamptz,
  p_status public.ingestion_status,
  p_rows_upserted integer,
  p_rows_failed integer,
  p_notes text
)
returns void
language sql
as $$
  insert into public.ingestion_runs
    (source_name, started_at, finished_at, status, rows_upserted, rows_failed, notes)
  values
    (p_source_name, p_started_at, p_finished_at, p_status, p_rows_upserted, p_rows_failed, p_notes);
$$;

revoke execute on function public.upsert_state(text, text, jsonb, text) from public;
revoke execute on function public.upsert_county(text, text, text, jsonb) from public;
revoke execute on function public.upsert_zip_centroid(text, text, text, double precision, double precision) from public;
revoke execute on function public.upsert_water_stress_basin(text, text, jsonb, numeric, text, text) from public;
revoke execute on function public.upsert_egrid_subregion(text, text, jsonb, numeric, integer) from public;
revoke execute on function public.upsert_drought_condition(text, public.drought_level, date) from public;
revoke execute on function public.upsert_electricity_price(text, integer, numeric) from public;
revoke execute on function public.upsert_facility(
  uuid, text, text, double precision, double precision, text, text, public.facility_status,
  numeric, public.cooling_type, text, integer, text, text, text, text, date, text, text
) from public;
revoke execute on function public.log_ingestion_run(
  text, timestamptz, timestamptz, public.ingestion_status, integer, integer, text
) from public;

grant execute on function public.upsert_state(text, text, jsonb, text) to service_role;
grant execute on function public.upsert_county(text, text, text, jsonb) to service_role;
grant execute on function public.upsert_zip_centroid(text, text, text, double precision, double precision) to service_role;
grant execute on function public.upsert_water_stress_basin(text, text, jsonb, numeric, text, text) to service_role;
grant execute on function public.upsert_egrid_subregion(text, text, jsonb, numeric, integer) to service_role;
grant execute on function public.upsert_drought_condition(text, public.drought_level, date) to service_role;
grant execute on function public.upsert_electricity_price(text, integer, numeric) to service_role;
grant execute on function public.upsert_facility(
  uuid, text, text, double precision, double precision, text, text, public.facility_status,
  numeric, public.cooling_type, text, integer, text, text, text, text, date, text, text
) to service_role;
grant execute on function public.log_ingestion_run(
  text, timestamptz, timestamptz, public.ingestion_status, integer, integer, text
) to service_role;
