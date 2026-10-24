-- Everything the Local Brief needs from the database, in one migration:
--   1. Bulk ZIP seeding that resolves each ZIP's county by location.
--   2. Public read RPCs: ZIP lookup and facilities near a point.
--   3. Where a bill summary came from, on state_legislation.
--   4. The curated organizations directory.

-- 1. Bulk ZIP centroid upsert -------------------------------------------------
-- The existing single-row upsert_zip_centroid takes a county FIPS from the
-- caller. Census's ZCTA-to-county relationship file uses 2020 county codes,
-- which don't match our counties table for Connecticut (2022 planning
-- regions). So the county -- and the state with it -- is resolved here, from the
-- ZIP's Census internal point against our own county polygons: the containing
-- county, or the nearest within 20 km for points that land just offshore of a
-- simplified coastline. Rows with no county that close are skipped and
-- reported back to the caller as failures rather than guessed.
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
      extensions.ST_SetSRID(
        extensions.ST_MakePoint((r->>'lon')::double precision, (r->>'lat')::double precision),
        4326
      )::extensions.geography as g
    from jsonb_array_elements(p_rows) r
  ),
  resolved as (
    select i.zip, i.g, c.fips, c.state
    from input i
    left join lateral (
      select c.fips, c.state
      from public.counties c
      where extensions.ST_DWithin(c.geom, i.g, 20000)
      order by extensions.ST_Distance(c.geom, i.g)
      limit 1
    ) c on true
    where c.fips is not null
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

-- 2. Public read RPCs ---------------------------------------------------------
create or replace function public.zip_lookup(p_zip text)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'zip', z.zip,
    'state', z.state,
    'state_name', s.name,
    'county_fips', z.county_fips,
    'county_name', c.name,
    'lat', extensions.ST_Y(z.location::extensions.geometry),
    'lon', extensions.ST_X(z.location::extensions.geometry)
  )
  from public.zip_centroids z
  left join public.counties c on c.fips = z.county_fips
  left join public.states s on s.state = z.state
  where z.zip = p_zip;
$$;

comment on function public.zip_lookup is 'ZIP -> state, county, and representative point, from the seeded Census ZCTA table. Null when the ZIP is not a ZCTA (e.g. PO-box-only ZIPs).';

-- Point-based so the brief works for any lookup path (seeded ZCTA or the
-- fallback geocoder), unlike facilities_within_radius, which needs the ZIP to
-- be in zip_centroids. Returns the facility's own citation fields too.
create or replace function public.facilities_near_point(
  p_lon double precision,
  p_lat double precision,
  p_radius_miles numeric
)
returns table (
  id uuid,
  name text,
  operator text,
  status public.facility_status,
  announced_load_mw numeric,
  cooling_type public.cooling_type,
  build_year integer,
  state text,
  source_name text,
  source_url text,
  source_date date,
  distance_miles numeric,
  lat double precision,
  lon double precision
)
language sql
stable
as $$
  with pt as (
    select extensions.ST_SetSRID(extensions.ST_MakePoint(p_lon, p_lat), 4326)::extensions.geography as g
  )
  select
    f.id, f.name, f.operator, f.status, f.announced_load_mw, f.cooling_type, f.build_year, f.state,
    f.source_name, f.source_url, f.source_date,
    round((extensions.ST_Distance(f.location, pt.g) / 1609.34)::numeric, 1),
    extensions.ST_Y(f.location::extensions.geometry),
    extensions.ST_X(f.location::extensions.geometry)
  from public.facilities f, pt
  where extensions.ST_DWithin(f.location, pt.g, least(p_radius_miles, 100) * 1609.34)
  order by extensions.ST_Distance(f.location, pt.g);
$$;

grant execute on function public.zip_lookup(text) to anon, authenticated;
grant execute on function public.facilities_near_point(double precision, double precision, numeric) to anon, authenticated;

-- 3. Bill summary provenance ---------------------------------------------------
-- The brief asks for a plain-language summary per bill. Open States carries an
-- official abstract for some states and only a title for others; the UI must
-- say which one the reader is looking at, never pass a title off as a summary.
alter table public.state_legislation
  add column if not exists summary_source text not null default 'title',
  add column if not exists openstates_url text,
  add column if not exists matched_terms text[];

comment on column public.state_legislation.summary_source is '''abstract'' (official abstract from Open States) or ''title'' (no abstract available; summary repeats the title).';

-- 4. Organizations directory ---------------------------------------------------
-- Curated by hand (no API lists these). Every row cites where its description
-- came from and when it was last checked, and nothing is shown publicly until
-- the project owner sets verified = true.
--
-- kind separates official channels (the state's ratepayer advocate, its utility
-- commission) from civic and community groups, so the brief can lead with the
-- neutral, official ones. stated_position records a group's own public stance
-- on data centers in its own terms, or stays null when it has none -- the UI
-- labels it rather than letting the list read as one side's directory.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'organization_kind') then
    create type public.organization_kind as enum (
      'ratepayer_advocate',
      'utility_commission',
      'local_government',
      'community_group',
      'environmental_group',
      'civic_group',
      'industry_group',
      'other'
    );
  end if;
end $$;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind public.organization_kind not null,
  website text not null,
  description text not null,
  stated_position text,
  states text[] not null,
  county_fips text[],                       -- null = serves the whole state(s)
  source_url text not null,
  checked_on date not null,
  curated_by text,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, website)
);

create index if not exists organizations_states_idx on public.organizations using gin (states);
create index if not exists organizations_county_idx on public.organizations using gin (county_fips);

comment on table public.organizations is 'Hand-curated directory for the Local Brief. Only verified rows are returned to the public.';

-- Statewide rows match every ZIP in the state; county rows match only their
-- counties. County-specific first, then official channels before groups.
create or replace function public.organizations_for_place(p_state text, p_county_fips text)
returns setof public.organizations
language sql
stable
as $$
  select o.*
  from public.organizations o
  where o.verified
    and p_state = any(o.states)
    and (o.county_fips is null or p_county_fips = any(o.county_fips))
  order by
    (o.county_fips is not null) desc,
    case o.kind
      when 'ratepayer_advocate' then 0
      when 'utility_commission' then 1
      when 'local_government' then 2
      else 3
    end,
    o.name;
$$;

-- The one table in this project with row-level security: everything else is
-- fully public by design (see grant_public_read), but unverified drafts here
-- name real organizations and must not leak through the public API before the
-- owner checks them. The service role (ingest/curation) bypasses RLS.
alter table public.organizations enable row level security;

drop policy if exists organizations_public_read_verified on public.organizations;
create policy organizations_public_read_verified on public.organizations
  for select to anon, authenticated
  using (verified);

grant select on public.organizations to anon, authenticated;
grant execute on function public.organizations_for_place(text, text) to anon, authenticated;
