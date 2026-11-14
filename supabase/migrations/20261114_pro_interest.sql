-- Free, voluntary Pro interest (not a subscription).
-- A user must be signed in and may view, change, or withdraw only their own interest.
create table if not exists public.pro_interest (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferred_plan text not null check (preferred_plan in ('weekly','monthly','annual','undecided')),
  notify_on_launch boolean not null default true check (notify_on_launch = true),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pro_interest enable row level security;
revoke all on public.pro_interest from anon, authenticated;
grant select, insert, update, delete on public.pro_interest to authenticated;

create policy "Members view own Pro interest" on public.pro_interest
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Members register own Pro interest" on public.pro_interest
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Members update own Pro interest" on public.pro_interest
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Members withdraw own Pro interest" on public.pro_interest
  for delete to authenticated using ((select auth.uid()) = user_id);
