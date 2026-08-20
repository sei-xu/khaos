-- Unifies chat history across the web app and the Telegram bot into one
-- shared conversation, instead of the web app never persisting at all and
-- Telegram keeping a separate history per chat_id in telegram_chats.
--
-- Single row (id = 'khaos'): this is a personal, single-owner assistant with
-- no auth/multi-tenant model (every other table already uses an "allow all"
-- RLS policy for the same reason — see schema.sql), so there's exactly one
-- conversation to keep in sync across browser tabs/devices and Telegram.
--
-- telegram_chats is left in place (unread from now on) rather than dropped,
-- so its existing transcripts aren't lost; it can be dropped in a later
-- migration once nobody needs to look back at it.
create table if not exists "public"."chat_history" (
    "id" text primary key default 'khaos',
    "history" jsonb not null default '[]'::jsonb,
    "updated_at" timestamptz not null default now()
);

comment on table "public"."chat_history" is
    'The one shared Khaos conversation, read/written by both the web app (anon key) and the Telegram bot Edge Function (service-role key). Single row, id = ''khaos''.';

alter table "public"."chat_history" enable row level security;

create policy "allow all" on "public"."chat_history" using (true) with check (true);
