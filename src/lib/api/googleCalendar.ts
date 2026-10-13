import { supabase } from '../supabaseClient';

function unwrap<T>({ data, error }: { data: T | null; error: unknown }): T {
  if (error) throw error;
  return data as T;
}

export interface GoogleCalendarStatus {
  connected: boolean;
  calendar_id: string | null;
  last_sync_at: string | null;
  last_error: string | null;
}

export const googleCalendarApi = {
  // google_calendar_status() is a SECURITY DEFINER RPC: it's the only way
  // the browser (anon key) can see anything about the connection, since
  // google_calendar_account has RLS on with no policies.
  async status(): Promise<GoogleCalendarStatus> {
    const response = await supabase.rpc('google_calendar_status');
    const rows = unwrap<GoogleCalendarStatus[]>(response);
    return (
      rows[0] ?? {
        connected: false,
        calendar_id: null,
        last_sync_at: null,
        last_error: null,
      }
    );
  },
};
