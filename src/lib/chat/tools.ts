// Browser binding for the chat agent's database tools.
//
// All the actual logic — tool schemas, argument coercion, the executor —
// lives in toolsCore.ts, which is dependency-free so the Telegram bot Edge
// Function (Deno) can share it. This file just injects the app's own Supabase
// client and schema-search function, and re-exports everything the rest of the
// app imported from here before the split, so call sites are unchanged.
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';
import { searchSchema } from './schemaSearch';
import { executeTool as coreExecuteTool } from './toolsCore';

// A separate client instance (same project, same anon key — the app has no
// auth session to desync) that tags every request with
// `x-khaos-author: assistant`, so insert_moment() (see the migration
// alongside this change) can stamp authored_by correctly on the INSERT
// itself instead of racing a later UPDATE. Every write this module makes is
// the assistant acting on a tool call, so the header is global to this
// client rather than per-call.
const assistantDb = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { global: { headers: { 'x-khaos-author': 'assistant' } } }
);

export function executeTool(
  rawName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  return coreExecuteTool({ db: assistantDb, searchSchema }, rawName, args);
}

export {
  ALLOWED_TABLES,
  READ_TOOL_DEFINITIONS,
  WRITE_TOOL_DEFINITIONS,
  OVERSIGHT_TOOL_DEFINITIONS,
  TOOL_DEFINITIONS,
  READ_TOOLS,
  WRITE_TOOLS,
  OVERSIGHT_TOOLS,
  normalizeToolName,
  coerceFilters,
  coerceValues,
  describeAction,
} from './toolsCore';

export type {
  AllowedTable,
  RowFilter,
  ToolDeps,
  SearchSchemaArgs,
  QueryRowsArgs,
  InsertRowArgs,
  UpdateRowsArgs,
  DeleteRowsArgs,
  CallRpcArgs,
} from './toolsCore';
