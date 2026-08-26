import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient, useIsMutating } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useEvents } from '../hooks/useEvents';
import { useTasks, useProjects, useFields } from '../hooks/useHierarchy';
import { useAllTaskLogs } from '../hooks/useTimeTracking';
import { Button } from '../components/common/ui';
import CalendarView, { type DueItem } from '../components/calendar/CalendarView';
import EventModal from '../components/calendar/EventModal';
import type { Event, Task, Project, Field, TaskLog } from '../lib/types';

export default function CalendarPage() {
  const navigate = useNavigate();
  const { data: events = [] } = useEvents() as { data: Event[] };
  const { data: tasks = [] } = useTasks() as { data: Task[] };
  const { data: projects = [] } = useProjects() as { data: Project[] };
  const { data: fields = [] } = useFields() as { data: Field[] };
  const { data: taskLogs = [] } = useAllTaskLogs() as { data: TaskLog[] };
  const [searchParams, setSearchParams] = useSearchParams();
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [creatingAt, setCreatingAt] = useState<Date | null>(null);
  const queryClient = useQueryClient();
  const isMutating = useIsMutating();

  // Auto-update: periodically refetch events/tasks so changes made
  // elsewhere (or by the assistant) show up without a manual reload. Skips
  // while a mutation is in flight to avoid racing an edit in progress.
  useEffect(() => {
    const id = setInterval(() => {
      if (isMutating > 0) return;
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['taskLogs'] });
    }, 30_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient]);

  // Deep-link support for the [[event:id]] chat chip — mirrors the
  // ?taskId= pattern used by TasksPage/DashboardPage: derive the open
  // event straight from the URL at render time rather than syncing it
  // into local state via an effect.
  const deepLinkedEventId = searchParams.get('eventId');
  const deepLinkedEvent = deepLinkedEventId
    ? (events.find((e) => e.id === deepLinkedEventId) ?? null)
    : null;
  const openEvent = editingEvent ?? deepLinkedEvent;

  function closeEditing() {
    setEditingEvent(null);
    if (deepLinkedEventId) {
      searchParams.delete('eventId');
      setSearchParams(searchParams, { replace: true });
    }
  }

  function handleMilestoneClick(item: DueItem) {
    navigate(
      item.type === 'task' ? `/tasks?taskId=${item.id}` : `/projects/${item.id}`
    );
  }

  return (
    <div className="flex h-full flex-col px-6 py-5">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="font-display text-nyx-100 text-display-lg">Calendar</h1>
        <Button onClick={() => setCreatingAt(new Date())}>
          <Plus size={14} /> New event
        </Button>
      </div>

      <CalendarView
        events={events}
        tasks={tasks}
        projects={projects}
        fields={fields}
        taskLogs={taskLogs}
        onSlotClick={setCreatingAt}
        onEventClick={setEditingEvent}
        onMilestoneClick={handleMilestoneClick}
      />

      {creatingAt && (
        <EventModal
          defaultStart={creatingAt}
          onClose={() => setCreatingAt(null)}
        />
      )}
      {openEvent && <EventModal event={openEvent} onClose={closeEditing} />}
    </div>
  );
}
