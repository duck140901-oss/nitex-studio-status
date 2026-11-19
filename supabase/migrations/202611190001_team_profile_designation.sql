-- Add a separate, self-editable designation field for Studio Team profile cards.
-- Do not reuse profiles.role: that field is used for application permissions.
alter table public.profiles
  add column if not exists designation text;

comment on column public.profiles.designation is
  'Self-managed job designation shown on the Studio Team profile card.';
