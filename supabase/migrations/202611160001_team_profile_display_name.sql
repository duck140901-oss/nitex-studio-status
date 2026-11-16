-- Allow each authenticated team member to maintain their own profile-card display name.
-- The existing full_name remains unchanged because it is used to match accounts to the fixed team directory.
alter table public.profiles
  add column if not exists display_name text;

-- Enforce that authenticated users can update only their own profile row.
-- This is a restrictive policy, so it combines with the table's existing permissive policies.
alter table public.profiles enable row level security;
drop policy if exists profiles_update_only_own_row on public.profiles;
create policy profiles_update_only_own_row
  on public.profiles
  as restrictive
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

comment on column public.profiles.display_name is
  'Optional self-managed display name shown on the Studio Team profile card.';
