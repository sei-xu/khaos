// Framework-agnostic core of the chat agent's database tools: tool schemas,
// argument coercion, and the executor. No runtime imports, no browser or Deno
// globals — the host injects a Supabase client and a schema-search function via
// ToolDeps. Shared by the in-app agent (src/lib/chat/tools.ts) and the Telegram
// bot Edge Function.
import type Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';

// Everything the tool executor needs from its host, injected rather than
// imported: the browser app supplies its anon-key client (src/lib/chat/tools.ts)
// and the Telegram Edge Function supplies its service-role client. Keeping this
// module import-free at runtime is what lets Deno bundle it unchanged.
export interface ToolDeps {
  db: SupabaseClient;
  searchSchema: (query: string) => unknown;
}

export const ALLOWED_TABLES = [
  'fields',
  'projects',
  'sections',
  'tasks',
  'task_items',
  'task_logs',
  'events',
  'routines',
  'moments',
  'moment_tags',
  'work_tags',
  'moment_tag_entities',
  'work_tag_entities',
  'sections_sequence',
  'tasks_sequence',
] as const;

export type AllowedTable = (typeof ALLOWED_TABLES)[number];

const VALID_OPERATORS = [
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'like',
  'ilike',
  'is',
  'in',
  'cs',
  'cd',
  'ov',
] as const;

type FilterOperator = (typeof VALID_OPERATORS)[number];

export interface RowFilter {
  column: string;
  operator: FilterOperator;
  value: unknown;
}

export interface SearchSchemaArgs {
  query: string;
}
export interface QueryRowsArgs {
  table: AllowedTable;
  select?: string;
  filters?: RowFilter[];
  orderBy?: string;
  ascending?: boolean;
  limit?: number;
}
export interface InsertRowArgs {
  table: AllowedTable;
  values: Record<string, unknown>;
}
export interface UpdateRowsArgs {
  table: AllowedTable;
  values: Record<string, unknown>;
  filters: RowFilter[];
}
export interface DeleteRowsArgs {
  table: AllowedTable;
  filters: RowFilter[];
}
export interface CallRpcArgs {
  name: string;
  args?: Record<string, unknown>;
}

function cleanPayload(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(cleanPayload);
  } else if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([_, v]) => v !== null && v !== undefined && v !== '')
        .map(([k, v]) => [k, cleanPayload(v)])
    );
  }
  return obj;
}

// Defensive typing: models occasionally emit `filters` as a JSON *string*
// instead of a real array (and `ascending`/`limit` as strings too). Accept
// both shapes here and coerce in executeTool() below, rather than rejecting
// an otherwise-fine tool call over a cosmetic type mismatch.
const looseFiltersSchema = {
  type: ['array', 'string'],
  description:
    'Row filters, combined with AND. Each entry MUST have all three keys column, operator and value — never a plain {column: value} map. ' +
    'Example: to filter event_type = scheduled, pass [{"column":"event_type","operator":"eq","value":"scheduled"}]. ' +
    'Range-typed columns (e.g. tstzrange columns like "duration" or "schedule") have no separate start/end column to filter — ' +
    'to test overlap with a window, use operator "ov" with a Postgres range literal value, ' +
    'e.g. [{"column":"duration","operator":"ov","value":"[2026-07-09 00:00:00,2026-07-10 00:00:00)"}] to find events on 2026-07-09. ' +
    'When filtering by a name or other free-text column on a value the person typed (not a value you already confirmed from a prior result), ' +
    'use operator "ilike" with %wildcards% instead of "eq" — stored values may differ in case, language, or phrasing from what was typed. ' +
    'Prefer a real array of these objects; a JSON-encoded string of the same shape is also accepted.',
  items: {
    type: 'object',
    properties: {
      column: { type: 'string' },
      operator: { type: 'string', enum: VALID_OPERATORS },
      value: {
        type: 'string',
        description: 'The literal value to compare against.',
      },
    },
    required: ['column', 'operator', 'value'],
    additionalProperties: false,
  },
};

// Backs the moment_note SYSTEM_INSTRUCTION already tells the model to fill
// in ("whenever you use a tool to modify an entity's status, priority, due
// date, or estimate, you must... provide it in the 'reason' parameter") —
// that instruction predates this property actually existing on the schema,
// so it was silently a no-op until now. See the backfillReason() executor
// below for how it reaches the resulting moment row.
const reasonSchema = {
  type: 'string',
  description:
    "Why this change is happening, in your own words — required whenever you're changing status, priority, due date, or estimate on tasks, sections, projects, or routines. Extract it from the conversation rather than inventing one. Attached to the moment this write logs, authored as 'assistant' rather than 'user' so it's clear the note is a stated reason, not a guess.",
};

// Grouped by category rather than one flat list — read/query and
// write/mutation today, joined by an oversight category from Phase 4 on.
// A flat list that made sense at six tools stops making sense at twenty.
//
// Anthropic's native tool shape: {name, description, input_schema}. Passed
// straight through as the `tools` param on client.messages.create — no
// wrapping needed the way OpenAI's {type:'function', function:{...}} did.
// Explicit `Anthropic.Tool[]` annotation matters here, not just style: without
// it TS widens each input_schema.type to `string`, which no longer satisfies
// Tool's `"object"` literal requirement.
export const READ_TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: 'list_tasks_marked_for_day',
    description:
      'Lists tasks the user marked "for" a given day via the today/notToday moment toggle (the star button on a task) — i.e. what they want to work on that day, before any of it has been put on the calendar. ' +
      "A task's state for a day is derived, not a stored column: the most recent of its 'today'/'notToday' moments whose value equals that date decides whether it's currently marked. " +
      'This tool does that derivation for you — use it instead of querying the moments table directly for this purpose, since a plain filter on moments would show every toggle event, not just the current state. ' +
      'Excludes deleted and done/cancelled tasks. Returns full task rows (id, name, status, priority, due, estimate, section_id) so you can plan/schedule them — e.g. by creating "scheduled" events (insert_row on the events table, event_type "scheduled", linked via task_id) — without a second lookup.',
    input_schema: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description:
            "The day to check, as 'YYYY-MM-DD' in the user's own timezone — compute it from the Temporal Context prefix's current_time/timezone (for 'today') rather than guessing.",
        },
      },
      required: ['date'],
      additionalProperties: false,
    },
  },
  {
    name: 'search_schema',
    description:
      "Searches the database's schema (tables, columns, enum values, callable RPC functions) by keyword.",
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Keyword to search for.' },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'query_rows',
    description: `Reads rows from a table (SELECT). Allowed tables: fields, projects, sections, tasks, task_items, task_logs, events, routines, moments, moment_tags, work_tags, moment_tag_entities, work_tag_entities, sections_sequence, tasks_sequence.`,
    input_schema: {
      type: 'object',
      properties: {
        table: { type: 'string', enum: ALLOWED_TABLES },
        select: {
          type: 'string',
          description: 'Comma-separated columns or "*"',
        },
        filters: looseFiltersSchema,
        orderBy: { type: 'string' },
        ascending: {
          type: ['boolean', 'string'],
          description: 'true/false. May be sent as a string.',
        },
        limit: {
          type: ['integer', 'string'],
          description: 'Max rows to return. May be sent as a string.',
        },
      },
      required: ['table'],
      additionalProperties: false,
    },
  },
];

// New tools default here: require an explicit, reviewed decision to mark a
// tool as auto-executing instead. As agent autonomy grows, the cost of a
// wrong default goes up — keep the safe path the path of least resistance.
export const WRITE_TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: 'insert_row',
    description: `Inserts a single new row into a table. Allowed tables: ${ALLOWED_TABLES.join(', ')}.`,
    input_schema: {
      type: 'object',
      properties: {
        table: { type: 'string', enum: ALLOWED_TABLES },
        values: {
          type: 'object',
          description: 'Column/value pairs to insert.',
          additionalProperties: true,
        },
        reason: reasonSchema,
      },
      required: ['table', 'values'],
      additionalProperties: false,
    },
  },
  {
    name: 'update_rows',
    description: `Updates rows matching given filters. Allowed tables: ${ALLOWED_TABLES.join(', ')}.`,
    input_schema: {
      type: 'object',
      properties: {
        table: { type: 'string', enum: ALLOWED_TABLES },
        values: {
          type: 'object',
          description: 'Column/value pairs to set.',
          additionalProperties: true,
        },
        filters: looseFiltersSchema,
        reason: reasonSchema,
      },
      required: ['table', 'values', 'filters'],
      additionalProperties: false,
    },
  },
  {
    name: 'delete_rows',
    description: `Deletes rows matching given filters. Allowed tables: ${ALLOWED_TABLES.join(', ')}.`,
    input_schema: {
      type: 'object',
      properties: {
        table: { type: 'string', enum: ALLOWED_TABLES },
        filters: looseFiltersSchema,
      },
      required: ['table', 'filters'],
      additionalProperties: false,
    },
  },
  {
    name: 'call_rpc',
    description: 'Calls a Postgres RPC function exposed by Supabase.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the RPC function.' },
        args: {
          type: 'object',
          description: 'Named arguments for the RPC function.',
          additionalProperties: true,
        },
      },
      required: ['name'],
      additionalProperties: false,
    },
  },
];

// Phase 4's oversight category: read-only, like READ_TOOL_DEFINITIONS, but
// kept separate because it reads from oversight_notes specifically rather
// than any of ALLOWED_TABLES — a dedicated tool instead of routing it through
// query_rows, since the model shouldn't need to know that table exists to use
// the generic CRUD tools.
export const OVERSIGHT_TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: 'recall_oversight_notes',
    description:
      'Reads recent notes from the background oversight agent — patterns or notable batches of database changes it noticed across the whole app, not just what happened in this conversation. Use this to inform a proactive check-in (e.g. the session opener) or when the user asks something these notes might address. An empty result is normal, not an error — most of the time there is nothing to report.',
    input_schema: {
      type: 'object',
      properties: {
        since: {
          type: 'string',
          description:
            'ISO 8601 timestamp; only notes created after this. Defaults to roughly the last 48 hours.',
        },
        limit: {
          type: ['integer', 'string'],
          description: 'Max notes to return, default 10, capped at 25. May be sent as a string.',
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
];

export const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  ...READ_TOOL_DEFINITIONS,
  ...WRITE_TOOL_DEFINITIONS,
  ...OVERSIGHT_TOOL_DEFINITIONS,
];

// Derived from the grouped arrays above rather than listed separately, so
// the two can't drift out of sync as tools are added.
export const READ_TOOLS = new Set(READ_TOOL_DEFINITIONS.map((t) => t.name));
export const WRITE_TOOLS = new Set(WRITE_TOOL_DEFINITIONS.map((t) => t.name));
export const OVERSIGHT_TOOLS = new Set(
  OVERSIGHT_TOOL_DEFINITIONS.map((t) => t.name)
);

function assertAllowedTable(table: string): asserts table is AllowedTable {
  if (!(ALLOWED_TABLES as readonly string[]).includes(table)) {
    throw new Error(`"${table}" is not a recognized table.`);
  }
}

function applyFilters<
  T extends { filter: (column: string, operator: string, value: unknown) => T },
>(query: T, filters?: RowFilter[]): T {
  let q = query;
  for (const f of filters || []) {
    q = q.filter(f.column, f.operator, f.value);
  }
  return q;
}

// The model occasionally collapses filters into a plain {column: value} map
// (e.g. {"id": "Chicago"}) instead of the documented array-of-objects shape.
// Treat every entry as an equality filter rather than dropping it — silently
// coercing an unrecognized shape to [] here would strip the WHERE clause
// entirely, turning an update/delete meant for one row into one that hits
// every row in the table.
function objectToFilters(obj: Record<string, unknown>): RowFilter[] {
  return Object.entries(obj).map(([column, value]) => ({
    column,
    operator: 'eq' as const,
    value,
  }));
}

// Filters may legitimately arrive as a real array, or (because the model
// sometimes emits them that way, and Groq's schema now permits it) as a
// JSON-encoded string, or as a plain object map. Normalize to an array here,
// once, for every tool.
export function coerceFilters(raw: unknown): RowFilter[] {
  if (Array.isArray(raw)) return raw as RowFilter[];
  if (raw !== null && typeof raw === 'object') {
    return objectToFilters(raw as Record<string, unknown>);
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      if (parsed !== null && typeof parsed === 'object') {
        return objectToFilters(parsed);
      }
      return [];
    } catch {
      return [];
    }
  }
  return [];
}

// The model sometimes calls the singular/plural variant of a tool name, or
// uses "set" instead of the documented "values" key for insert_row/
// update_rows. Normalize both before dispatch so a cosmetic mismatch doesn't
// surface as "Unknown tool" or silently drop the payload.
const TOOL_NAME_ALIASES: Record<string, string> = {
  update_row: 'update_rows',
  insert_rows: 'insert_row',
  delete_row: 'delete_rows',
  query_row: 'query_rows',
};

export function normalizeToolName(name: string): string {
  return TOOL_NAME_ALIASES[name] ?? name;
}

// Like filters, "values" (or the "set" alias) may arrive as a real object or
// as a JSON-encoded string.
export function coerceValues(
  raw: Record<string, unknown>
): Record<string, unknown> {
  const candidate = raw.values ?? raw.set ?? {};
  if (typeof candidate === 'string') {
    try {
      const parsed = JSON.parse(candidate);
      return parsed !== null && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return candidate as Record<string, unknown>;
}

function coerceBoolean(raw: unknown, fallback: boolean): boolean {
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'string') return raw.toLowerCase() !== 'false';
  return fallback;
}

function coerceInt(raw: unknown, fallback: number): number {
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') {
    const n = parseInt(raw, 10);
    return Number.isNaN(n) ? fallback : n;
  }
  return fallback;
}

// Mirrors moment_entity_column() in schema.sql — only these four tables have
// entity triggers that log moments. Tables without an entry here (fields,
// events, task_items, task_logs, moments itself, the tag/sequence tables)
// either don't get moments at all or aren't reachable through this generic
// path, so a reason has nothing to attach to.
const MOMENT_ENTITY_COLUMN: Partial<Record<AllowedTable, string>> = {
  tasks: 'task_id',
  sections: 'section_id',
  projects: 'project_id',
  routines: 'routine_id',
};

// The insert/update trigger already logged a moment with moment_note null
// and authored_by='user' by the time this runs (Postgres AFTER triggers fire
// synchronously, before the client sees the response) — this attaches the
// reason the model gave to whichever of those moments resulted from *this*
// call. Scoped by affected row id, a `since` timestamp captured just before
// the write, and moment_note still being null, so it can't reach a moment
// from an unrelated request or overwrite a note someone already gave.
// Best-effort: a failed backfill shouldn't undo a write that already
// succeeded, so errors are swallowed here rather than thrown.
async function backfillReason(
  db: SupabaseClient,
  table: AllowedTable,
  rows: unknown,
  reason: unknown,
  since: string
): Promise<void> {
  if (typeof reason !== 'string' || !reason.trim()) return;
  const entityColumn = MOMENT_ENTITY_COLUMN[table];
  if (!entityColumn) return;

  const ids = (Array.isArray(rows) ? rows : [])
    .map((r) => (r as { id?: unknown }).id)
    .filter((id): id is string => typeof id === 'string');
  if (!ids.length) return;

  const { error } = await db
    .from('moments')
    .update({ moment_note: reason, authored_by: 'assistant' })
    .in(entityColumn, ids)
    .gte('created_at', since)
    .is('moment_note', null);
  if (error) console.error('backfillReason failed', error.message);
}

export async function executeTool(
  deps: ToolDeps,
  rawName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const { db, searchSchema } = deps;
  const name = normalizeToolName(rawName);
  switch (name) {
    case 'list_tasks_marked_for_day': {
      const a = args as { date?: unknown };
      const date = typeof a.date === 'string' ? a.date : undefined;
      if (!date) throw new Error('list_tasks_marked_for_day requires a date');

      const { data: momentRows, error: momentsError } = await db
        .from('moments')
        .select('task_id, moment_type, created_at')
        .in('moment_type', ['today', 'notToday'])
        .eq('value', date)
        .not('task_id', 'is', null)
        .order('created_at', { ascending: false });
      if (momentsError) throw new Error(momentsError.message);

      const seen = new Set<string>();
      const markedTaskIds: string[] = [];
      for (const row of (momentRows ?? []) as {
        task_id: string;
        moment_type: 'today' | 'notToday';
      }[]) {
        if (seen.has(row.task_id)) continue;
        seen.add(row.task_id);
        if (row.moment_type === 'today') markedTaskIds.push(row.task_id);
      }
      if (!markedTaskIds.length) return { date, tasks: [] };

      const { data: tasks, error: tasksError } = await db
        .from('tasks')
        .select('id, name, status, priority, due, estimate, section_id')
        .in('id', markedTaskIds)
        .is('deleted_at', null)
        .not('status', 'in', '(done,cancelled)');
      if (tasksError) throw new Error(tasksError.message);
      return { date, tasks: cleanPayload(tasks ?? []) };
    }
    case 'search_schema': {
      return cleanPayload(searchSchema((args as any).query));
    }
    case 'query_rows': {
      const a = args as any;
      assertAllowedTable(a.table);
      let q = db.from(a.table).select(a.select || '*');

      const safeFilters = coerceFilters(a.filters);
      if (safeFilters.length) q = applyFilters(q, safeFilters);

      if (a.orderBy) {
        q = q.order(a.orderBy, { ascending: coerceBoolean(a.ascending, true) });
      }

      const lim = coerceInt(a.limit, 8);
      q = q.limit(Math.min(lim, 40));

      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return { rows: cleanPayload(data ?? []), count: data?.length ?? 0 };
    }
    case 'insert_row': {
      const a = args as any;
      assertAllowedTable(a.table);
      const since = new Date().toISOString();
      const { data, error } = await db
        .from(a.table)
        .insert(coerceValues(a) as never)
        .select();
      if (error) throw new Error(error.message);
      await backfillReason(db, a.table, data, a.reason, since);
      return { inserted: cleanPayload(data ?? []) };
    }
    case 'update_rows': {
      const a = args as any;
      assertAllowedTable(a.table);
      const since = new Date().toISOString();
      let q = db.from(a.table).update(coerceValues(a) as never);
      q = applyFilters(q, coerceFilters(a.filters));
      const { data, error } = await q.select();
      if (error) throw new Error(error.message);
      await backfillReason(db, a.table, data, a.reason, since);
      return { updated: cleanPayload(data ?? []), count: data?.length ?? 0 };
    }
    case 'delete_rows': {
      const a = args as any;
      assertAllowedTable(a.table);
      let q = db.from(a.table).delete();
      q = applyFilters(q, coerceFilters(a.filters));
      const { data, error } = await q.select();
      if (error) throw new Error(error.message);
      return { deleted: cleanPayload(data ?? []), count: data?.length ?? 0 };
    }
    case 'call_rpc': {
      const a = args as unknown as CallRpcArgs;
      const { data, error } = await db.rpc(a.name as any, a.args || {});
      if (error) throw new Error(error.message);
      return { result: cleanPayload(data) };
    }
    case 'recall_oversight_notes': {
      const a = args as any;
      const since =
        typeof a.since === 'string'
          ? a.since
          : new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const lim = Math.min(coerceInt(a.limit, 10), 25);
      const { data, error } = await db
        .from('oversight_notes')
        .select('summary,entity_refs,severity,window_start,window_end,created_at')
        .gt('created_at', since)
        .order('created_at', { ascending: false })
        .limit(lim);
      if (error) throw new Error(error.message);
      return { notes: cleanPayload(data ?? []) };
    }
    default:
      throw new Error(`Unknown tool "${name}"`);
  }
}

export function describeAction(
  name: string,
  args: Record<string, unknown>
): string {
  return `${name}(${JSON.stringify(args)})`;
}
