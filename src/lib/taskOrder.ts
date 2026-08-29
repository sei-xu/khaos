import { parseRange } from './range';
import { isOverdueInTz, isTodayInTz } from './timezone';
import type { Id, Status, Task } from './types';

// Critério cronológico dentro de uma seção: target.start primeiro, senão
// due, senão vai para o final. É o desempate da ordem topológica — a
// sequência (tasks_sequence) manda primeiro, datas decidem entre tarefas
// disponíveis ao mesmo tempo (ver topoChronoOrder).
export function taskChronoKey(task: Task): number {
  const { start } = parseRange(task.target);
  if (start) return start.getTime();
  if (task.due) return new Date(task.due).getTime();
  return Infinity;
}

// Ordering for infinite sections only (see SectionColumn) — a different,
// coarser sort than the sequence/chrono order used elsewhere: tasks are
// grouped by status first, and within the active-work group, by urgency.
const STATUS_GROUP: Partial<Record<Status, number>> = {
  planning: 0,
  todo: 0,
  in_progress: 0,
  in_review: 1,
  waiting: 2,
  paused: 3,
};
const ACTIVE_WORK_GROUP = 0;

function urgencyBucket(task: Task, markedToday: boolean): number {
  if (task.due && isOverdueInTz(task.due, task.status)) return 0;
  if (markedToday) return 1;
  if (task.due && isTodayInTz(task.due)) return 2;
  if (taskChronoKey(task) !== Infinity) return 3;
  return 4;
}

// Sorts the active (non-done/cancelled) tasks of an infinite section:
//   1. to-do / in progress / planning, ordered by urgency —
//      overdue > marked for today > due today > has a target/due date
//      (soonest first) > no date
//   2. in review
//   3. waiting
//   4. paused
// Settled (done/cancelled) tasks are handled separately by the caller —
// see infiniteFade.ts for their fade-then-hide treatment.
export function infiniteSectionOrder(
  tasks: Task[],
  markedTodayIds: Set<Id>
): Task[] {
  return [...tasks].sort((a, b) => {
    const groupA = STATUS_GROUP[a.status] ?? ACTIVE_WORK_GROUP;
    const groupB = STATUS_GROUP[b.status] ?? ACTIVE_WORK_GROUP;
    if (groupA !== groupB) return groupA - groupB;
    if (groupA !== ACTIVE_WORK_GROUP) return 0;

    const bucketA = urgencyBucket(a, markedTodayIds.has(a.id));
    const bucketB = urgencyBucket(b, markedTodayIds.has(b.id));
    if (bucketA !== bucketB) return bucketA - bucketB;
    if (bucketA === 3) return taskChronoKey(a) - taskChronoKey(b);
    return 0;
  });
}
