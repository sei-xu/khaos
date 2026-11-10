-- Root-cause fix for the auto-nudge-on-self race: insert_moment() always
-- left authored_by at its 'user' default, so stampAssistantMoments()
-- (toolsCore.ts) had to patch it to 'assistant' in a second, later UPDATE —
-- leaving a window where the Realtime INSERT payload the DB-change watcher
-- sees (momentFeed.ts, useDbChangeFeed.ts) still says authored_by='user' for
-- a moment the assistant itself just created. Reading the author straight
-- off the request here means the INSERT already carries the right value, so
-- the watcher's `authored_by !== 'assistant'` filter is sufficient on its
-- own with no race.
--
-- PostgREST exposes the inbound HTTP headers as the `request.headers` GUC
-- for the lifetime of the request's transaction, which is the same
-- transaction the AFTER triggers (and thus insert_moment) run in. The tool
-- executor's own Supabase client (src/lib/chat/tools.ts,
-- supabase/functions/_shared/khaos.ts) sends `x-khaos-author: assistant` on
-- every request it makes; nothing else does, so this defaults to 'user'
-- everywhere else (direct SQL, other service-role calls, the app's own
-- user-facing client).
CREATE OR REPLACE FUNCTION "public"."insert_moment"("p_entity_column" "text", "p_entity_id" "uuid", "p_moment_type" "public"."moment_types", "p_value" "text" DEFAULT NULL::"text", "p_note" "text" DEFAULT NULL::"text", "p_previous_value" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $_$
declare
  v_author text;
begin
  if p_entity_column not in ('project_id', 'section_id', 'task_id', 'event_id', 'routine_id') then
    raise exception 'insert_moment: invalid entity column "%"', p_entity_column;
  end if;

  begin
    v_author := current_setting('request.headers', true)::json ->> 'x-khaos-author';
  exception when others then
    v_author := null;
  end;
  if v_author is distinct from 'assistant' then
    v_author := 'user';
  end if;

  execute format(
    'insert into moments (%I, moment_type, value, moment_note, previous_value, authored_by) values ($1, $2, $3, $4, $5, $6)',
    p_entity_column
  ) using p_entity_id, p_moment_type, p_value, p_note, p_previous_value, v_author;
end;
$_$;
