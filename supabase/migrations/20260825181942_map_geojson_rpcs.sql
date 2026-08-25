-- One GeoJSON-emitting RPC per map layer. Centralizing ST_AsGeoJSON here means the
-- Next.js route handlers stay a thin fetch-and-cache wrapper, and PostgREST never has
-- to hand the client raw PostGIS geography (WKB hex), which it can't turn into GeoJSON
-- on its own.
--
-- Polygon layers are simplified (topology-preserving) before serialization: this is a
-- national choropleth map, not a parcel-boundary lookup, so full TIGER/WRI/EPA
-- resolution is wasted payload. 0.01 degrees is roughly 1km at US latitudes -- coarse
-- enough to cut payload substantially, fine enough that basin/county/subregion shapes
-- stay recognizable at the zoom levels this map actually uses.

create or replace function public.facilities_geojson()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'type', 'FeatureCollection',
    'features', coalesce(jsonb_agg(
      jsonb_build_object(
        'type', 'Feature',
        'geometry', extensions.ST_AsGeoJSON(f.location::extensions.geometry)::jsonb,
        'properties', jsonb_build_object(
          'id', f.id,
          'name', f.name,
          'operator', f.operator,
          'status', f.status,
          'announced_load_mw', f.announced_load_mw,
          'cooling_type', f.cooling_type,
          'power_source', f.power_source,
          'build_year', f.build_year,
          'state', f.state,
          'applicable_local_policy', f.applicable_local_policy,
          'opposition_note', f.opposition_note,
          'source_name', f.source_name,
          'source_url', f.source_url,
          'source_date', f.source_date,
          'confidence', f.confidence
        )
      )
    ), '[]'::jsonb)
  )
  from public.facilities f;
$$;

comment on function public.facilities_geojson is 'All facilities as a GeoJSON FeatureCollection, full properties inlined for click-to-detail with no second fetch.';

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
        'geometry', extensions.ST_AsGeoJSON(
          extensions.ST_SimplifyPreserveTopology(w.geom::extensions.geometry, 0.01)
        )::jsonb,
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

comment on function public.water_stress_geojson is 'WRI Aqueduct basins as GeoJSON, for the water stress overlay. Rarely changes; cache aggressively.';

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
        'geometry', extensions.ST_AsGeoJSON(
          extensions.ST_SimplifyPreserveTopology(e.geom::extensions.geometry, 0.01)
        )::jsonb,
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

comment on function public.egrid_geojson is 'EPA eGRID subregions as GeoJSON, for the grid carbon intensity overlay. Annual refresh; cache aggressively.';

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
        'geometry', extensions.ST_AsGeoJSON(
          extensions.ST_SimplifyPreserveTopology(c.geom::extensions.geometry, 0.01)
        )::jsonb,
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

comment on function public.drought_geojson is 'Latest weekly drought category per county as GeoJSON. Refresh weekly alongside the NIDIS ingestion job.';

create or replace function public.electricity_price_geojson()
returns jsonb
language sql
stable
as $$
  with base_2020 as (
    select state, avg_price_cents_per_kwh as base_price
    from public.electricity_prices
    where year = 2020
  ),
  latest as (
    select distinct on (state) state, year, avg_price_cents_per_kwh
    from public.electricity_prices
    order by state, year desc
  )
  select jsonb_build_object(
    'type', 'FeatureCollection',
    'features', coalesce(jsonb_agg(
      jsonb_build_object(
        'type', 'Feature',
        'geometry', extensions.ST_AsGeoJSON(
          extensions.ST_SimplifyPreserveTopology(s.geom::extensions.geometry, 0.01)
        )::jsonb,
        'properties', jsonb_build_object(
          'state', s.state,
          'name', s.name,
          'latest_year', lt.year,
          'avg_price_cents_per_kwh', lt.avg_price_cents_per_kwh,
          'base_2020_price_cents_per_kwh', b.base_price,
          'pct_change_vs_2020', case
            when b.base_price is not null and b.base_price != 0 and lt.avg_price_cents_per_kwh is not null
            then round(((lt.avg_price_cents_per_kwh - b.base_price) / b.base_price * 100)::numeric, 1)
            else null
          end
        )
      )
    ), '[]'::jsonb)
  )
  from public.states s
  left join latest lt on lt.state = s.state
  left join base_2020 b on b.state = s.state;
$$;

comment on function public.electricity_price_geojson is 'State residential electricity price, indexed to 2020 at query time (no stored index column, so re-basing never requires re-ingestion).';

grant execute on function public.facilities_geojson() to anon, authenticated;
grant execute on function public.water_stress_geojson() to anon, authenticated;
grant execute on function public.egrid_geojson() to anon, authenticated;
grant execute on function public.drought_geojson() to anon, authenticated;
grant execute on function public.electricity_price_geojson() to anon, authenticated;
