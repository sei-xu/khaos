// Browser binding for the chat agent's database tools.
//
// All the actual logic — tool schemas, argument coercion, the executor —
// lives in toolsCore.ts, which is dependency-free so the Telegram bot Edge
// Function (Deno) can share it. This file just injects the app's own Supabase
// client and schema-search function, and re-exports everything the rest of the
// app imported from here before the split, so call sites are unchanged.
import { supabase } from '../supabaseClient';
import { searchSchema } from './schemaSearch';
import { getTimezone } from '../timezone';
import { executeTool as coreExecuteTool } from './toolsCore';

export function executeTool(
  rawName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  return coreExecuteTool(
    { db: supabase, searchSchema, timezone: getTimezone() },
    rawName,
    args
  );
}

export {
  ALLOWED_TABLES,
  READ_TOOL_DEFINITIONS,
  WRITE_TOOL_DEFINITIONS,
  OVERSIGHT_TOOL_DEFINITIONS,
  ROUTINE_TOOL_DEFINITIONS,
  TOOL_DEFINITIONS,
  READ_TOOLS,
  WRITE_TOOLS,
  OVERSIGHT_TOOLS,
  ROUTINE_TOOLS,
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
