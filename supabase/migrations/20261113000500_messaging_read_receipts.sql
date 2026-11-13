-- Store each member's read position independently for unread message badges.
alter table public.studio_conversation_members
  add column if not exists last_read_at timestamptz not null default now();

create or replace function public.studio_mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null or not public.studio_is_conversation_member(p_conversation_id) then
    raise exception 'Only conversation members can mark this chat read';
  end if;

  update public.studio_conversation_members
  set last_read_at = now()
  where conversation_id = p_conversation_id
    and user_id = auth.uid();
end;
$$;

revoke all on function public.studio_mark_conversation_read(uuid) from public;
grant execute on function public.studio_mark_conversation_read(uuid) to authenticated;
