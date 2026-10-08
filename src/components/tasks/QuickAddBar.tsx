import { useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import {
  useProjects,
  useSections,
  useTasks,
  useTaskMutations,
} from '../../hooks/useHierarchy';
import { parseQuickAdd } from '../../lib/quickAdd';
import {
  Modal,
  Select,
  TextInput,
  Button,
  PriorityPicker,
  StatusPicker,
} from '../common/ui';
import DueEditor from '../common/DueEditor';
import TaskDetailModal from './TaskDetailModal';
import type { Id, Priority, Status, Task } from '../../lib/types';

interface Draft {
  name: string;
  priority: Priority;
  status: Status;
  due: string | null;
  projectId: Id | null;
  sectionId: Id | null;
}

export default function QuickAddBar() {
  const { data: projects = [] } = useProjects();
  const { data: sections = [] } = useSections();
  const { data: tasks = [] } = useTasks();
  const { create } = useTaskMutations();

  const [raw, setRaw] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [created, setCreated] = useState<Task | null>(null);

  const sectionsForProject = useMemo(
    () => sections.filter((s) => s.project_id === draft?.projectId),
    [sections, draft?.projectId]
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!raw.trim()) return;
    // Clear a previous failure, otherwise the inline error below stays on
    // screen in the freshly opened dialog -- the mutation only resets its
    // own error state on the next mutate().
    create.reset();
    const parsed = parseQuickAdd(raw, projects);
    const defaultSections = parsed.projectId
      ? sections.filter((s) => s.project_id === parsed.projectId)
      : [];
    setDraft({
      name: parsed.name || raw,
      priority: parsed.priority || 'medium',
      status: 'planning',
      due: parsed.dueDate ? parsed.dueDate.toISOString() : null,
      projectId: parsed.projectId,
      sectionId: defaultSections[0]?.id || null,
    });
  }

  function confirmCreate() {
    if (!draft || !draft.sectionId || !draft.name.trim()) return;
    create.mutate(
      {
        section_id: draft.sectionId,
        name: draft.name.trim(),
        priority: draft.priority,
        status: draft.status,
        due: draft.due,
      },
      {
        onSuccess: (task) => {
          setDraft(null);
          setRaw('');
          setCreated(task);
        },
      }
    );
  }

  const openTask = created
    ? (tasks.find((t) => t.id === created.id) ?? created)
    : null;

  return (
    <>
      <form onSubmit={handleSubmit} className="relative max-w-xl flex-1">
        <Sparkles
          size={15}
          className="text-nyx-500 pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
        />
        <input
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder="Quick add: Finish report tomorrow 3pm #ProjectX !high"
          className="border-nyx-700 bg-nyx-800 text-nyx-100 placeholder:text-nyx-500 focus:border-eros-400 text-body w-full rounded-full border py-2 pr-3 pl-9 focus:outline-hidden"
        />
      </form>

      <Modal
        open={Boolean(draft)}
        onClose={() => setDraft(null)}
        onSubmit={confirmCreate}
        title="New task"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button
              onClick={confirmCreate}
              disabled={
                !draft?.sectionId || !draft?.name.trim() || create.isPending
              }
            >
              Create task
            </Button>
          </>
        }
      >
        {draft && (
          <div className="space-y-3">
            <div>
              <label className="text-nyx-400 text-caption mb-1 block font-medium">
                Name
              </label>
              <TextInput
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                autoFocus
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-nyx-400 text-caption mb-1 block font-medium">
                  Project
                </label>
                <Select
                  value={draft.projectId ?? ''}
                  className="w-full"
                  onChange={(e) => {
                    const projectId = e.target.value;
                    const firstSection = sections.find(
                      (s) => s.project_id === projectId
                    );
                    setDraft({
                      ...draft,
                      projectId,
                      sectionId: firstSection?.id ?? null,
                    });
                  }}
                >
                  <option value="" disabled>
                    Choose a project
                  </option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="text-nyx-400 text-caption mb-1 block font-medium">
                  Section
                </label>
                <Select
                  value={draft.sectionId ?? ''}
                  className="w-full"
                  onChange={(e) =>
                    setDraft({ ...draft, sectionId: e.target.value })
                  }
                  disabled={!draft.projectId}
                >
                  <option value="" disabled>
                    {draft.projectId
                      ? 'Choose a section'
                      : 'Pick a project first'}
                  </option>
                  {sectionsForProject.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-nyx-400 text-caption mb-1 block font-medium">
                  Priority
                </label>
                <PriorityPicker
                  value={draft.priority}
                  onChange={(priority) => setDraft({ ...draft, priority })}
                />
              </div>
              <div>
                <label className="text-nyx-400 text-caption mb-1 block font-medium">
                  Due
                </label>
                <DueEditor
                  value={draft.due}
                  status={draft.status}
                  onChange={(due) => setDraft({ ...draft, due })}
                />
              </div>
            </div>
            <div>
              <label className="text-nyx-400 text-caption mb-1 block font-medium">
                Status
              </label>
              <StatusPicker
                value={draft.status}
                onChange={(status) => setDraft({ ...draft, status })}
              />
            </div>
            {!sectionsForProject.length && draft.projectId && (
              <p className="text-tartarus-500 text-caption">
                This project has no sections yet — add one first.
              </p>
            )}
            {create.isError && (
              <p className="text-tartarus-500 text-caption">
                Couldn&apos;t create the task — try again.
              </p>
            )}
          </div>
        )}
      </Modal>

      {openTask && (
        <TaskDetailModal
          taskId={openTask.id}
          task={openTask}
          onClose={() => setCreated(null)}
          onOpenTask={setCreated}
        />
      )}
    </>
  );
}
