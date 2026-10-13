-- Bulk facility sources (e.g. Data Center Watch's export) have unreliable state
-- fields -- a mix of 2-letter codes, full state names, city names leaked into
-- the state column, and blanks. Rather than hand-clean that per source, resolve
-- the state authoritatively from the coordinates themselves via point-in-polygon
-- against our own `states` geometry (already loaded and accurate). p_state is
-- still accepted for callers with a clean value (e.g. the hand-curated AZ
-- seed's 2-letter codes) and used as-is when it looks valid; otherwise this
-- falls back to the geometry lookup.
--
-- Same signature as before, so existing grants (service_role only) carry over
-- unchanged with CREATE OR REPLACE.
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
language plpgsql
as $$
declare
  v_state text;
  v_point extensions.geography;
begin
  v_point := extensions.ST_SetSRID(extensions.ST_MakePoint(p_lon, p_lat), 4326)::extensions.geography;

  if p_state is not null and length(trim(p_state)) = 2 then
    v_state := upper(trim(p_state));
  else
    select s.state into v_state
    from public.states s
    where extensions.ST_Contains(s.geom::extensions.geometry, v_point::extensions.geometry)
    limit 1;
  end if;

  insert into public.facilities (
    id, name, operator, location, state, county_fips, status, announced_load_mw,
    cooling_type, power_source, build_year, applicable_local_policy, opposition_note,
    source_name, source_url, source_date, curated_by, confidence, updated_at
  )
  values (
    coalesce(p_id, gen_random_uuid()), p_name, p_operator, v_point,
    v_state, p_county_fips, p_status, p_announced_load_mw, p_cooling_type, p_power_source,
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
end;
$$;
