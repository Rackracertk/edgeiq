-- Shared, normalized research snapshots from a commercially authorized sports-data feed.
-- Visitors never write this table. The refresh-research Edge Function is service-role only.
create table if not exists public.sports_cache (
  sport text primary key check (sport in ('NBA', 'NFL')),
  payload jsonb not null,
  source_label text not null,
  refreshed_at timestamptz not null default now()
);
alter table public.sports_cache enable row level security;
revoke all on public.sports_cache from anon, authenticated;
create index if not exists sports_cache_refreshed_idx on public.sports_cache(refreshed_at);
