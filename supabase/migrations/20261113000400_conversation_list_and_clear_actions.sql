-- Delete This conversation hides it only from the requesting member's list.
create table if not exists public.studio_conversation_hidden (
  conversation_id uuid not null references public.studio_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

alter table public.studio_conversation_hidden enable row level security;

drop policy if exists "Members read their own hidden conversations" on public.studio_conversation_hidden;
create policy "Members read their own hidden conversations"
  on public.studio_conversation_hidden for select to authenticated
  using (user_id = auth.uid() and public.studio_is_conversation_member(conversation_id));

drop policy if exists "Members hide conversations from their own list" on public.studio_conversation_hidden;
create policy "Members hide conversations from their own list"
  on public.studio_conversation_hidden for insert to authenticated
  with check (user_id = auth.uid() and public.studio_is_conversation_member(conversation_id));

grant select, insert on public.studio_conversation_hidden to authenticated;

-- Clear Chat permanently removes all message rows for all members, while the
-- conversation and its membership remain in both chat lists.
create or replace function public.studio_clear_conversation(p_conversation_id uuid)
returns integer
language plpgsql security definer
set search_path = public, auth
as $$
declare
  deleted_count integer;
begin
  if auth.uid() is null or not public.studio_is_conversation_member(p_conversation_id) then
    raise exception 'Only conversation members can clear this chat';
  end if;
  delete from public.studio_messages where conversation_id = p_conversation_id;
  get diagnostics deleted_count = row_count;
  update public.studio_conversations set updated_at = now() where id = p_conversation_id;
  return deleted_count;
end;
$$;
revoke all on function public.studio_clear_conversation(uuid) from public;
grant execute on function public.studio_clear_conversation(uuid) to authenticated;
