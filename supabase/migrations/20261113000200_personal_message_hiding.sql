-- Hide a message from only the current user's inbox. The original message is
-- retained for every other member of the conversation.
create table if not exists public.studio_message_hidden (
  message_id uuid not null references public.studio_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create index if not exists studio_message_hidden_user_idx
  on public.studio_message_hidden(user_id, message_id);

alter table public.studio_message_hidden enable row level security;

drop policy if exists "Members read their own hidden messages" on public.studio_message_hidden;
create policy "Members read their own hidden messages"
  on public.studio_message_hidden for select to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.studio_messages message
      where message.id = message_id
        and public.studio_is_conversation_member(message.conversation_id)
    )
  );

drop policy if exists "Members hide messages only in their inbox" on public.studio_message_hidden;
create policy "Members hide messages only in their inbox"
  on public.studio_message_hidden for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.studio_messages message
      where message.id = message_id
        and public.studio_is_conversation_member(message.conversation_id)
    )
  );

grant select, insert on public.studio_message_hidden to authenticated;
