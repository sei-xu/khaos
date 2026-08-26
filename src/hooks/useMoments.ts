import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { momentsApi, type EntityRef } from '../lib/api/moments';
import { todayDateStringInTz } from '../lib/timezone';
import type { Id } from '../lib/types';

function refKey(entityRef: EntityRef | null | undefined): [string, Id] | null {
  return entityRef ? (Object.entries(entityRef)[0] as [string, Id]) : null;
}

export function useNotes(entityRef: EntityRef) {
  const key = refKey(entityRef);
  return useQuery({
    queryKey: ['moments', key?.[0], key?.[1]],
    queryFn: () => momentsApi.listForEntity(entityRef),
    enabled: Boolean(key),
  });
}

// Set of task ids marked "for today", for the TaskRow/TaskDetailModal
// toggle button. Same one-query-for-everyone pattern as useScheduledTaskIds.
export function useTodayTaskIds(date: string = todayDateStringInTz()) {
  return useQuery({
    queryKey: ['moments', 'today', date],
    queryFn: () => momentsApi.taskIdsMarkedForDay(date),
  });
}

// Task ids left marked on some past day and never resolved for today —
// used to show faded "still marked from before" pills in the Marked group.
export function useMarkedPastTaskIds(beforeDate: string = todayDateStringInTz()) {
  return useQuery({
    queryKey: ['moments', 'today', 'past', beforeDate],
    queryFn: () => momentsApi.taskIdsMarkedPast(beforeDate),
  });
}

export function useTodayMutations(date: string = todayDateStringInTz()) {
  const qc = useQueryClient();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ['moments', 'today', date] });
  return {
    mark: useMutation({
      mutationFn: (taskId: Id) => momentsApi.markForDay(taskId, date),
      onSuccess: invalidate,
    }),
    unmark: useMutation({
      mutationFn: (taskId: Id) => momentsApi.unmarkForDay(taskId, date),
      onSuccess: invalidate,
    }),
  };
}

export function useNoteMutations(entityRef: EntityRef) {
  const qc = useQueryClient();
  const key = refKey(entityRef);
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ['moments', key?.[0], key?.[1]] });
  return {
    addNote: useMutation({
      mutationFn: (note: string) => momentsApi.addNote(entityRef, note),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: Id) => momentsApi.remove(id),
      onSuccess: invalidate,
    }),
  };
}
