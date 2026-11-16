-- Ensure authenticated users have a permissive path to update their own profile row.
-- The restrictive policy from 202611160001 remains in place and prevents updates to other users' rows.
drop policy if exists profiles_update_own_row on public.profiles;
create policy profiles_update_own_row
  on public.profiles
  as permissive
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
