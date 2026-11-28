create table if not exists public.edgeiq_script_cache (
 sport text not null check (sport in ('NBA','NFL','MLB','NHL','NCAAF','NCAAB','WNBA','SOCCER','TENNIS','MMA')),
 league text not null, event_id text not null, payload jsonb not null, source_label text not null,
 refreshed_at timestamptz not null default now(), primary key(sport,league,event_id)
);
alter table public.edgeiq_script_cache enable row level security;
revoke all on public.edgeiq_script_cache from public, anon, authenticated;
grant select, insert, update, delete on public.edgeiq_script_cache to service_role;
create index if not exists edgeiq_script_cache_refresh_idx on public.edgeiq_script_cache(refreshed_at);
