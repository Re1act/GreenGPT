-- Let the ZIP seed say which county a ZIP belongs to.
--
-- 20261023120000_local_brief.sql resolved every ZIP's county from its Census
-- internal point against our county polygons. Those polygons are the 1:20M
-- cartographic file, simplified enough that points near a county line land on
-- the wrong side: 577 of 33,486 ZIPs (1.7%) disagreed with Census's own
-- ZCTA-to-county relationship file, a few in the wrong state (05902, Vermont,
-- came out in a New Hampshire county).
--
-- Now each row may carry a county_fips hint -- the county holding most of the
-- ZIP's land, from the relationship file. A hint that names a county in our
-- table wins. Otherwise the point-in-polygon match is the fallback: that covers
-- Connecticut, whose relationship-file codes are the pre-2022 counties rather
-- than the planning regions our counties table uses.
create or replace function public.upsert_zip_centroids(p_rows jsonb)
returns jsonb
language plpgsql
as $$
declare
  v_upserted integer;
  v_total integer;
begin
  v_total := jsonb_array_length(p_rows);

  with input as (
    select
      r->>'zip' as zip,
      r->>'county_fips' as county_hint,
      extensions.ST_SetSRID(
        extensions.ST_MakePoint((r->>'lon')::double precision, (r->>'lat')::double precision),
        4326
      )::extensions.geography as g
    from jsonb_array_elements(p_rows) r
  ),
  resolved as (
    select i.zip, i.g, coalesce(h.fips, near.fips) as fips, coalesce(h.state, near.state) as state
    from input i
    left join public.counties h on h.fips = i.county_hint
    left join lateral (
      select c.fips, c.state
      from public.counties c
      where h.fips is null
        and extensions.ST_DWithin(c.geom, i.g, 20000)
      order by extensions.ST_Distance(c.geom, i.g)
      limit 1
    ) near on true
    where coalesce(h.fips, near.fips) is not null
  )
  insert into public.zip_centroids (zip, state, county_fips, location, source, updated_at)
  select zip, state, fips, g, 'Census Gazetteer ZCTA', now()
  from resolved
  on conflict (zip) do update set
    state = excluded.state,
    county_fips = excluded.county_fips,
    location = excluded.location,
    source = excluded.source,
    updated_at = now();

  get diagnostics v_upserted = row_count;
  return jsonb_build_object('upserted', v_upserted, 'skipped', v_total - v_upserted);
end;
$$;

revoke execute on function public.upsert_zip_centroids(jsonb) from public;
grant execute on function public.upsert_zip_centroids(jsonb) to service_role;
