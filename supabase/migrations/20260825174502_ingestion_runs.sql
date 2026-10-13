-- Ingestion run log. Backs two requirements from the brief directly: an "as of" stamp
-- beside every output (section 6, "coefficients go stale fast") and stated coverage
-- gaps in the UI when a source's last successful run is old or partial. Every
-- scheduled job (drought, legislation, eGRID, EIA, etc.) and every manual curation
-- batch writes one row here on completion.
create type public.ingestion_status as enum ('success', 'partial', 'failed');

create table if not exists public.ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,             -- e.g. 'nidis_drought', 'openstates_legislation', 'facilities_manual'
  started_at timestamptz not null,
  finished_at timestamptz,
  status public.ingestion_status not null,
  rows_upserted integer,
  rows_failed integer,
  notes text,                            -- free text: partial-failure detail, coverage gaps, etc.

  created_at timestamptz not null default now()
);

create index if not exists ingestion_runs_source_idx on public.ingestion_runs (source_name, started_at desc);

comment on table public.ingestion_runs is 'Log of every scheduled ingestion job and manual curation batch. Query the latest row per source_name to render "as of" stamps and surface coverage gaps.';
