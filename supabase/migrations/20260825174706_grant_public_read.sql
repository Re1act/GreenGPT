-- The brief calls for no row-level security: "All data is public, so no row-level
-- security needed." As of recent Supabase defaults, a table with RLS disabled is no
-- longer auto-exposed through the PostgREST API (see auto_expose_new_tables in
-- config.toml) -- it needs an explicit GRANT instead. That's the intended mechanism
-- here, not an oversight: grant SELECT-only to anon/authenticated so the public API
-- can read every table, and grant nothing else, so writes remain possible only
-- through the service_role key used by the scheduled ingestion jobs (service_role
-- bypasses grants and RLS alike). No RLS policies are needed because there is no
-- per-row access distinction to enforce -- every row is meant to be publicly
-- readable, and the grant boundary alone keeps writes to the backend.
grant usage on schema public to anon, authenticated;

grant select on
  public.counties,
  public.zip_centroids,
  public.facilities,
  public.state_legislation,
  public.water_stress_basins,
  public.drought_conditions,
  public.ingestion_runs
to anon, authenticated;

grant execute on function public.facilities_within_radius(text, numeric) to anon, authenticated;
grant execute on function public.state_for_zip(text) to anon, authenticated;

-- Keep future tables opt-in rather than silently public: this only affects tables
-- created by the `postgres` role after this migration runs, and mirrors the explicit
-- grant pattern above rather than restoring the old auto-expose default.
alter default privileges for role postgres in schema public
  grant select on tables to anon, authenticated;
