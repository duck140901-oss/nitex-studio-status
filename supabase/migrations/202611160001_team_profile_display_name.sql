-- Allow each authenticated team member to maintain their own profile-card display name.
-- The existing full_name remains unchanged because it is used to match accounts to the fixed team directory.
alter table public.profiles
  add column if not exists display_name text;

comment on column public.profiles.display_name is
  'Optional self-managed display name shown on the Studio Team profile card. The profiles row RLS policy must restrict updates to auth.uid() = id.';
