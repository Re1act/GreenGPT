-- State data-center legislation, ingested from the OpenStates API and refreshed on a
-- schedule. `openstates_id` is the dedup key for re-ingestion (upsert on conflict).
create type public.bill_status as enum (
  'introduced',
  'in_committee',
  'passed_committee',
  'passed_chamber',
  'passed_legislature',
  'enacted',
  'vetoed',
  'failed'
);

create table if not exists public.state_legislation (
  id uuid primary key default gen_random_uuid(),
  openstates_id text unique,             -- OpenStates bill identifier; null for hand-entered rows
  state text not null,
  session text not null,                 -- e.g. "2026"
  bill_number text not null,
  sponsor text,
  status public.bill_status not null,
  title text not null,
  summary text not null,                 -- plain-language summary, not the legislative text
  source_url text not null,
  last_action_date date,
  last_action_text text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (state, session, bill_number)
);

create index if not exists state_legislation_state_idx on public.state_legislation (state, session);
create index if not exists state_legislation_summary_trgm_idx
  on public.state_legislation using gin (summary extensions.gin_trgm_ops);

comment on table public.state_legislation is 'Per-state data center legislation for the Local Brief. Ingested from OpenStates; upsert on openstates_id.';
