import { useQuery } from '@tanstack/react-query';
import { googleCalendarApi } from '../lib/api/googleCalendar';

export function useGoogleCalendarStatus() {
  return useQuery({
    queryKey: ['google-calendar-status'],
    queryFn: googleCalendarApi.status,
    // The sync cron runs every ~5 minutes; no point polling faster than that.
    refetchInterval: 5 * 60 * 1000,
  });
}
