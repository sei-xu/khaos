// Persistence for the one shared Khaos conversation (table "chat_history",
// single row, id = 'khaos') — the browser-side counterpart of loadHistory /
// saveHistory / clearHistory in supabase/functions/_shared/khaos.ts, which
// the Telegram bot uses against the same row. Keeping both in sync is what
// makes the conversation carry over across browser instances and Telegram.
import { supabase } from '../supabaseClient';
import type { ChatMessage } from './agent';
import type { Json } from '../database.types';

const CHAT_ROW_ID = 'khaos';
const MAX_STORED_MESSAGES = 60; // mirrors _shared/khaos.ts

export async function loadHistory(): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('chat_history')
    .select('history')
    .eq('id', CHAT_ROW_ID)
    .maybeSingle();
  if (error) {
    console.error('loadHistory failed', error.message);
    return [];
  }
  const history = (data?.history ?? []) as unknown as ChatMessage[];
  return Array.isArray(history) ? history : [];
}

export async function saveHistory(history: ChatMessage[]): Promise<void> {
  const trimmed = history.slice(-MAX_STORED_MESSAGES);
  const { error } = await supabase.from('chat_history').upsert(
    {
      id: CHAT_ROW_ID,
      history: trimmed as unknown as Json,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );
  if (error) console.error('saveHistory failed', error.message);
}

export async function clearHistory(): Promise<void> {
  const { error } = await supabase.from('chat_history').upsert(
    { id: CHAT_ROW_ID, history: [], updated_at: new Date().toISOString() },
    { onConflict: 'id' }
  );
  if (error) console.error('clearHistory failed', error.message);
}
