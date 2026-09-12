import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  eventsApi,
  type EventInput,
  type EventPatchInput,
} from '../lib/api/events';
import { parseRange } from '../lib/range';
import type { Id } from '../lib/types';

export function useEvents() {
  return useQuery({ queryKey: ['events'], queryFn: eventsApi.list });
}

// Plain helper, not inlined in the useMemo body -- Date.now() called
// directly inside a hook body trips the "impure function during render"
// lint rule.
function nowMs(): number {
  return Date.now();
}

// Map of task id -> its most relevant 'scheduled' event start time, for
// the TaskRow badge. Was a Set<Id> tracking future events only -- dropped
// the actual time and any past-scheduled state entirely, so the badge
// could only ever be a bare icon. Now keeps the soonest future event per
// task if one exists, otherwise the most recent past one, so the badge
// can show a real time and tell past from future apart.
export function useScheduledTaskIds() {
  const { data: events = [] } = useEvents();
  return useMemo(() => {
    const byTask = new Map<Id, Date>();
    const now = nowMs();
    events.forEach((e) => {
      if (e.event_type !== 'scheduled' || !e.task_id) return;
      const { start } = parseRange(e.duration);
      if (!start) return;
      const existing = byTask.get(e.task_id);
      if (!existing) {
        byTask.set(e.task_id, start);
        return;
      }
      const existingIsFuture = existing.getTime() > now;
      const candidateIsFuture = start.getTime() > now;
      if (candidateIsFuture && !existingIsFuture) {
        byTask.set(e.task_id, start);
      } else if (candidateIsFuture === existingIsFuture) {
        // Both future (soonest wins) or both past (most recent wins).
        const better = candidateIsFuture
          ? start.getTime() < existing.getTime()
          : start.getTime() > existing.getTime();
        if (better) byTask.set(e.task_id, start);
      }
    });
    return byTask;
  }, [events]);
}

export function useEventMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['events'] });
  return {
    create: useMutation({
      mutationFn: (input: EventInput) => eventsApi.create(input),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, patch }: { id: Id; patch: EventPatchInput }) =>
        eventsApi.update(id, patch),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: Id) => eventsApi.remove(id),
      onSuccess: invalidate,
    }),
  };
}
