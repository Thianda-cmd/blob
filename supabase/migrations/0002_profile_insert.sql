-- Let a signed-in user create their own profile row if the signup trigger ever missed it.
create policy "profiles: insert own" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
