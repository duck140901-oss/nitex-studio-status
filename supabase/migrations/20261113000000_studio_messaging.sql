-- Private team messaging for the five authorized NITEX Studio accounts.
-- Run this migration in the linked Supabase project's SQL editor.
create table if not exists public.studio_conversations (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 1 and 100),
  kind text not null default 'direct' check (kind in ('direct', 'group')),
  context_label text not null default '',
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.studio_conversation_members (
  conversation_id uuid not null references public.studio_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table if not exists public.studio_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.studio_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists studio_conversation_members_user_idx
  on public.studio_conversation_members(user_id, conversation_id);
create index if not exists studio_messages_conversation_created_idx
  on public.studio_messages(conversation_id, created_at desc);

create or replace function public.studio_touch_conversation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.studio_conversations set updated_at = new.created_at where id = new.conversation_id;
  return new;
end;
$$;
drop trigger if exists studio_messages_touch_conversation on public.studio_messages;
create trigger studio_messages_touch_conversation after insert on public.studio_messages
for each row execute function public.studio_touch_conversation();

create or replace function public.studio_create_conversation(
  p_title text,
  p_context_label text,
  p_member_emails text[]
) returns uuid
language plpgsql security definer
set search_path = public, auth
as $$
declare
  caller_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  member_ids uuid[];
  conversation_id uuid;
  allowed_emails text[] := array[
    'touhid@nitex.com', 'moru@nitex.com', 'shachi@nitex.com',
    'alamin@nitex.com', 'sowrav@nitex.com'
  ];
  requested_emails text[];
begin
  if auth.uid() is null or not (caller_email = any(allowed_emails)) then
    raise exception 'Only authorized Studio team members can create conversations';
  end if;
  if length(trim(coalesce(p_title, ''))) not between 1 and 100 then
    raise exception 'Conversation title must be between 1 and 100 characters';
  end if;
  requested_emails := array(select distinct lower(trim(email)) from unnest(coalesce(p_member_emails, array[]::text[])) as requested(email) where trim(email) <> '');
  if cardinality(requested_emails) < 1 or exists(select 1 from unnest(requested_emails) as requested(email) where not (email = any(allowed_emails))) then
    raise exception 'Choose one or more authorized Studio teammates';
  end if;
  select array_agg(distinct u.id) into member_ids
    from auth.users u where lower(u.email) = any(requested_emails || caller_email);
  if coalesce(cardinality(member_ids), 0) <> (select count(distinct u.id) from auth.users u where lower(u.email) = any(requested_emails || caller_email))
    or exists(select 1 from unnest(requested_emails || caller_email) as requested(email) where not exists(select 1 from auth.users u where lower(u.email) = requested.email)) then
    raise exception 'All selected team members must have an active dashboard account';
  end if;
  insert into public.studio_conversations(title, kind, context_label, created_by)
  values (trim(p_title), case when cardinality(member_ids) > 2 then 'group' else 'direct' end, left(trim(coalesce(p_context_label, '')), 180), auth.uid())
  returning id into conversation_id;
  insert into public.studio_conversation_members(conversation_id, user_id)
    select conversation_id, selected.member_id from unnest(member_ids) as selected(member_id);
  return conversation_id;
end;
$$;
revoke all on function public.studio_create_conversation(text, text, text[]) from public;
grant execute on function public.studio_create_conversation(text, text, text[]) to authenticated;

alter table public.studio_conversations enable row level security;
alter table public.studio_conversation_members enable row level security;
alter table public.studio_messages enable row level security;

-- Security-definer helper avoids recursive membership-table RLS checks.
create or replace function public.studio_is_conversation_member(p_conversation_id uuid)
returns boolean language sql stable security definer
set search_path = public, auth
as $$
  select exists(select 1 from public.studio_conversation_members m where m.conversation_id = p_conversation_id and m.user_id = auth.uid());
$$;
revoke all on function public.studio_is_conversation_member(uuid) from public;
grant execute on function public.studio_is_conversation_member(uuid) to authenticated;

drop policy if exists "Studio members read their conversations" on public.studio_conversations;
create policy "Studio members read their conversations" on public.studio_conversations for select to authenticated
using (public.studio_is_conversation_member(id));

drop policy if exists "Studio members read conversation membership" on public.studio_conversation_members;
create policy "Studio members read conversation membership" on public.studio_conversation_members for select to authenticated
using (public.studio_is_conversation_member(conversation_id));

drop policy if exists "Studio members read messages in their conversations" on public.studio_messages;
create policy "Studio members read messages in their conversations" on public.studio_messages for select to authenticated
using (public.studio_is_conversation_member(conversation_id));

drop policy if exists "Studio members send messages in their conversations" on public.studio_messages;
create policy "Studio members send messages in their conversations" on public.studio_messages for insert to authenticated
with check (sender_id = auth.uid() and public.studio_is_conversation_member(conversation_id));

grant select on public.studio_conversations, public.studio_conversation_members, public.studio_messages to authenticated;
grant insert on public.studio_messages to authenticated;
