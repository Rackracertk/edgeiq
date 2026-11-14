-- EDGEIQ launch data. Run in the linked Supabase project before deploying functions.
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  status text not null default 'incomplete',
  price_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;
revoke all on public.subscriptions from anon, authenticated;
grant select on public.subscriptions to authenticated;

drop policy if exists "Customers view own subscription" on public.subscriptions;
create policy "Customers view own subscription" on public.subscriptions
  for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.edgeiq_has_pro()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.subscriptions s
    where s.user_id = (select auth.uid())
      and s.status in ('active', 'trialing')
      and s.current_period_end > now()
  );
$$;
revoke all on function public.edgeiq_has_pro() from public, anon;
grant execute on function public.edgeiq_has_pro() to authenticated;

create table if not exists public.saved_research (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sport text not null check (sport in ('NBA','NFL')),
  player_id text not null,
  player_name text not null,
  stat_category text not null,
  prop_line numeric not null check (prop_line >= 0),
  direction text not null check (direction in ('over','under')),
  created_at timestamptz not null default now(),
  unique (user_id, sport, player_id, stat_category, prop_line, direction)
);

create index if not exists saved_research_owner_idx on public.saved_research(user_id, created_at desc);
alter table public.saved_research enable row level security;
revoke all on public.saved_research from anon, authenticated;
grant select, insert, delete on public.saved_research to authenticated;

drop policy if exists "Owners view saved research" on public.saved_research;
create policy "Owners view saved research" on public.saved_research
 for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Pro members save research" on public.saved_research;
create policy "Pro members save research" on public.saved_research
 for insert to authenticated with check ((select auth.uid()) = user_id and public.edgeiq_has_pro());

drop policy if exists "Owners remove saved research" on public.saved_research;
create policy "Owners remove saved research" on public.saved_research
 for delete to authenticated using ((select auth.uid()) = user_id);

-- No client insert/update/delete policy on subscriptions: ONLY trusted server-side Stripe webhook writes.
