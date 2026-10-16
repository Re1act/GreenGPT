-- Point -> region context for the simulator's mini-map. This is the simulator's
-- only server call: one lookup per click, not per slider drag. All arithmetic
-- stays client-side against lib/simulator/coefficients.json, per the brief.
--
-- What it returns and why:
--   egrid         every eGRID subregion containing the point. An array, not a
--                 single row, because EPA's own caveat is that subregion
--                 boundaries are approximate and can overlap -- the UI takes the
--                 first and says when there was more than one.
--   water_stress  WRI Aqueduct basin baseline stress, for the "local water stress
--                 context" output.
--   county        resolved from geometry, used to find the drought reading.
--   drought       the latest US Drought Monitor reading for that county.
--   state         2-letter state, for display.
-- Every piece is independently nullable: a point offshore, or in a gap between
-- simplified basin polygons, still gets whatever context does exist.
create or replace function public.simulator_region_context(
  p_lon double precision,
  p_lat double precision
)
returns jsonb
language sql
stable
as $$
  with pt as (
    select extensions.ST_SetSRID(extensions.ST_MakePoint(p_lon, p_lat), 4326)::extensions.geography as g
  ),
  eg as (
    select coalesce(
      jsonb_agg(jsonb_build_object('subregion_code', e.subregion_code, 'name', e.name)
                order by e.subregion_code),
      '[]'::jsonb
    ) as subregions
    from public.egrid_subregions e, pt
    where extensions.ST_Intersects(e.geom, pt.g)
  ),
  ws as (
    select w.basin_name, w.baseline_stress_score, w.baseline_stress_category, w.source_version
    from public.water_stress_basins w, pt
    where extensions.ST_Intersects(w.geom, pt.g)
    limit 1
  ),
  co as (
    select c.fips, c.name, c.state
    from public.counties c, pt
    where extensions.ST_Intersects(c.geom, pt.g)
    limit 1
  ),
  dr as (
    select d.drought_level, d.as_of_date
    from public.drought_conditions d
    join co on co.fips = d.county_fips
    order by d.as_of_date desc
    limit 1
  ),
  st as (
    select s.state
    from public.states s, pt
    where extensions.ST_Intersects(s.geom, pt.g)
    limit 1
  )
  select jsonb_build_object(
    'egrid', (select subregions from eg),
    'water_stress', (select to_jsonb(ws) from ws),
    'county', (select to_jsonb(co) from co),
    'drought', (select to_jsonb(dr) from dr),
    'state', coalesce((select state from st), (select state from co))
  );
$$;

comment on function public.simulator_region_context is 'eGRID subregion(s), water stress basin, county drought, and state for a point. Backs the simulator mini-map; one call per click.';

grant execute on function public.simulator_region_context(double precision, double precision) to anon, authenticated;
