drop policy if exists "Pro members save research" on public.saved_research;
drop policy if exists "Free beta members save own research" on public.saved_research;
create policy "Free beta members save own research" on public.saved_research for insert to authenticated with check ((select auth.uid())=user_id);
