import { useSyncActiveEntity } from '../../lib/activeEntityContext';
import { useState, type FormEvent } from 'react';
import { Link2 } from 'lucide-react';
import { Modal, TextInput, Select, Button } from '../common/ui';
import { EVENT_TYPES } from '../../lib/constants';
import { toDatetimeLocalValue } from '../../lib/dateUtils';
import { useEventMutations } from '../../hooks/useEvents';
import { useProjects, useTasks } from '../../hooks/useHierarchy';
import type { Event, EventType, Id, Project, Task } from '../../lib/types';

interface EventModalProps {
  event?: Event | null;
  defaultStart?: Date | null;
  onClose: () => void;
}

interface EventFormState {
  name: string;
  eventType: EventType;
  recurrent: boolean;
  start: string;
  end: string;
  taskId: Id | '';
  projectId: Id | '';
}

function parseStart(rangeStr?: string | null): Date {
  const m = rangeStr?.match(/^[[(]"?([^",]*)"?,/);
  return m ? new Date(m[1]) : new Date();
}

function parseEnd(rangeStr: string | null | undefined, fallback: Date): Date {
  const m = rangeStr?.match(/,"?([^",)\]]*)"?[)\]]$/);
  return m && m[1] ? new Date(m[1]) : fallback;
}

function addHour(date?: Date | string | null): Date {
  const d = new Date(date || Date.now());
  d.setHours(d.getHours() + 1);
  return d;
}

export default function EventModal({
  event,
  defaultStart,
  onClose,
}: EventModalProps) {
  const { create, update, remove } = useEventMutations();
  const { data: projects = [] } = useProjects() as { data: Project[] };
  const { data: tasks = [] } = useTasks() as { data: Task[] };
  useSyncActiveEntity('event', event?.id, event?.name);

  const [form, setForm] = useState<EventFormState>(() => ({
    name: event?.name || '',
    eventType: (event?.event_type as EventType) || 'scheduled',
    recurrent: event?.recurrent || false,
    start: toDatetimeLocalValue(
      event ? parseStart(event.duration as unknown as string) : defaultStart
    ),
    end: toDatetimeLocalValue(
      event
        ? parseEnd(event.duration as unknown as string, addHour(defaultStart))
        : addHour(defaultStart)
    ),
    taskId: (event?.task_id as Id) || '',
    projectId: (event?.project_id as Id) || '',
  }));

  // A "scheduled" (plan) event linked to a task doesn't need its own title —
  // it'll just show the task's name on the calendar. A custom title is still
  // allowed and will be shown alongside the task's name.
  const isTitleOptional =
    form.eventType === 'scheduled' && Boolean(form.taskId);
  const linkedTask = tasks.find((t) => t.id === form.taskId);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if ((!isTitleOptional && !form.name.trim()) || !form.start) return;

    const resolvedName = form.name.trim() || linkedTask?.name || '';
    if (!resolvedName) return; // safety net — shouldn't happen given the check above

    const payload = {
      name: resolvedName,
      eventType: form.eventType,
      recurrent: form.recurrent,
      start: new Date(form.start),
      end: form.end ? new Date(form.end) : null,
      taskId: form.taskId || null,
      projectId: form.projectId || null,
    };
    if (event) {
      update.mutate({ id: event.id, patch: payload }, { onSuccess: onClose });
    } else {
      create.mutate(payload, { onSuccess: onClose });
    }
  }

  function handleSubmitShortcut() {
    if (!isTitleOptional && !form.name.trim()) return;
    handleSubmit({ preventDefault: () => {} } as FormEvent);
  }

  function handleDelete() {
    if (event && window.confirm('Delete this event?')) {
      remove.mutate(event.id, { onSuccess: onClose });
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      onSubmit={handleSubmitShortcut}
      title={event ? 'Edit event' : 'New event'}
      footer={
        <>
          {event && (
            <Button variant="danger" onClick={handleDelete} className="mr-auto">
              Delete
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isTitleOptional && !form.name.trim()}
          >
            {event ? 'Save' : 'Create'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        {event?.google_event_id && (
          <p className="text-nyx-500 flex items-center gap-1.5 text-caption">
            <Link2 size={12} className="shrink-0" />
            Synced with Google Calendar — editing here pushes the change back.
          </p>
        )}
        <div>
          <label className="text-nyx-400 mb-1 block text-caption font-medium">
            Title
            {isTitleOptional &&
              ' (optional — defaults to the task\u2019s name)'}
          </label>
          <TextInput
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder={isTitleOptional ? linkedTask?.name : undefined}
            autoFocus
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-nyx-400 mb-1 block text-caption font-medium">
              Starts
            </label>
            <TextInput
              type="datetime-local"
              value={form.start}
              onChange={(e) => setForm({ ...form, start: e.target.value })}
            />
          </div>
          <div>
            <label className="text-nyx-400 mb-1 block text-caption font-medium">
              Ends
            </label>
            <TextInput
              type="datetime-local"
              value={form.end}
              onChange={(e) => setForm({ ...form, end: e.target.value })}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-nyx-400 mb-1 block text-caption font-medium">
              Type
            </label>
            <Select
              value={form.eventType}
              onChange={(e) =>
                setForm({ ...form, eventType: e.target.value as EventType })
              }
              className="w-full"
            >
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t === 'fixed' ? 'Fixed (meeting)' : 'Plan (flexible)'}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-end pb-2">
            <label className="text-nyx-300 flex items-center gap-2 text-body">
              <input
                type="checkbox"
                checked={form.recurrent}
                onChange={(e) =>
                  setForm({ ...form, recurrent: e.target.checked })
                }
                className="border-nyx-600 bg-nyx-800 accent-eros-500 h-4 w-4 rounded"
              />
              Recurring
            </label>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-nyx-400 mb-1 block text-caption font-medium">
              Linked project (optional)
            </label>
            <Select
              value={form.projectId}
              onChange={(e) =>
                setForm({ ...form, projectId: e.target.value as Id })
              }
              className="w-full"
            >
              <option value="">None</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="text-nyx-400 mb-1 block text-caption font-medium">
              Linked task (optional)
            </label>
            <Select
              value={form.taskId}
              onChange={(e) =>
                setForm({ ...form, taskId: e.target.value as Id })
              }
              className="w-full"
            >
              <option value="">None</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </form>
    </Modal>
  );
}
