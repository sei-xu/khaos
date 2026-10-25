-- insert_moment()'s own column whitelist was never updated when routine_id
-- was added to moments (and to chk_single_entity) — moment_entity_column()
-- already resolves 'routines' -> 'routine_id' as of the previous migration,
-- but insert_moment() rejected that column name, so every routines trigger
-- failed with "insert_moment: invalid entity column \"routine_id\"". Found
-- by smoke-testing 20261024010000 against the linked project.
CREATE OR REPLACE FUNCTION "public"."insert_moment"("p_entity_column" "text", "p_entity_id" "uuid", "p_moment_type" "public"."moment_types", "p_value" "text" DEFAULT NULL::"text", "p_note" "text" DEFAULT NULL::"text", "p_previous_value" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $_$
begin
  if p_entity_column not in ('project_id', 'section_id', 'task_id', 'event_id', 'routine_id') then
    raise exception 'insert_moment: invalid entity column "%"', p_entity_column;
  end if;

  execute format(
    'insert into moments (%I, moment_type, value, moment_note, previous_value) values ($1, $2, $3, $4, $5)',
    p_entity_column
  ) using p_entity_id, p_moment_type, p_value, p_note, p_previous_value;
end;
$_$;
