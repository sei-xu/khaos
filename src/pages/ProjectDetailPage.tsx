import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Trash2,
  ExternalLink,
  FolderKanban,
  CornerUpLeft,
  CornerDownRight,
} from 'lucide-react';
import {
  closestCenter,
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import {
  useProjects,
  useSections,
  useTasks,
  useTasksSequence,
  useSectionsSequence,
  useOrderedSectionIds,
  useProjectMutations,
  useSectionMutations,
} from '../hooks/useHierarchy';
import { STATUSES, PRIORITIES } from '../lib/constants';
import { Select, TextInput, EmptyState } from '../components/common/ui';
import SectionColumn, {
  SortableSectionWrapper,
} from '../components/projects/SectionColumn';
import type {
  LinkDir,
  LinkDragData,
  LinkingState,
} from '../components/projects/sequenceLinking';
import { useSequenceMutations } from '../hooks/useSequence';
import { topoChronoOrder, wouldCreateCycle } from '../lib/sequenceGraph';
import { taskChronoKey } from '../lib/taskOrder';
import TaskDetailModal from '../components/tasks/TaskDetailModal';
import TargetEditor from '../components/common/TargetEditor';
import { useSyncActiveEntity } from '../lib/activeEntityContext';
import type { Id, Priority, Section, Status, Task } from '../lib/types';

interface SectionBlockProps {
  sectionId: Id;
  section: Section;
  tasks: Task[];
  onOpenTask: (task: Task) => void;
  dragHandleProps?: React.HTMLAttributes<HTMLSpanElement>;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  linking: LinkingState | null;
  onToggleLink: (taskId: Id, dir: LinkDir) => void;
}

function SectionBlock({
  sectionId,
  section,
  tasks,
  onOpenTask,
  dragHandleProps,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  linking,
  onToggleLink,
}: SectionBlockProps) {
  const { data: seqEdges = [] } = useTasksSequence();
  const orderedTasks = useMemo(() => {
    const sectionTasks = tasks.filter((t) => t.section_id === sectionId);
    return topoChronoOrder(sectionTasks, seqEdges, taskChronoKey);
  }, [tasks, sectionId, seqEdges]);

  return (
    <SectionColumn
      section={section}
      orderedTasks={orderedTasks}
      onOpenTask={onOpenTask}
      dragHandleProps={dragHandleProps}
      onMoveUp={onMoveUp}
      onMoveDown={onMoveDown}
      canMoveUp={canMoveUp}
      canMoveDown={canMoveDown}
      linking={linking}
      onToggleLink={onToggleLink}
    />
  );
}

// Um único DndContext cobre dois tipos de arrasto: reordenar seções
// (sortable) e ligar tarefas em sequência (alças prev/next). A colisão
// filtra os droppables pelo tipo do arrasto ativo para um não interferir
// no outro.
const collisionDetection: CollisionDetection = (args) => {
  const isLink =
    (args.active.data.current as LinkDragData | undefined)?.type === 'link';
  const droppableContainers = args.droppableContainers.filter((c) =>
    isLink ? c.data.current?.type === 'task' : c.data.current?.type !== 'task'
  );
  return (isLink ? pointerWithin : closestCenter)({
    ...args,
    droppableContainers,
  });
};

export default function ProjectDetailPage() {
  const { id: projectId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: projects = [] } = useProjects();
  const { data: sections = [] } = useSections();
  const { data: tasks = [] } = useTasks();
  const { data: sectionEdges = [] } = useSectionsSequence();
  const { update: updateProject, remove: removeProject } =
    useProjectMutations();
  const { create: createSection, reorder: reorderSections } =
    useSectionMutations();

  const [newSectionName, setNewSectionName] = useState('');
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    })
  );

  const { data: seqEdges = [] } = useTasksSequence();
  const sequenceMutations = useSequenceMutations();
  // Modo "tocar-tocar": armado pela alça prev/next; o próximo toque numa
  // tarefa cria a ligação (em vez de abrir o modal).
  const [linking, setLinking] = useState<LinkingState | null>(null);
  // Alça sendo arrastada agora — usado só para o DragOverlay.
  const [activeLinkDrag, setActiveLinkDrag] = useState<LinkingState | null>(
    null
  );
  const [linkNotice, setLinkNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!linkNotice) return;
    const t = setTimeout(() => setLinkNotice(null), 3500);
    return () => clearTimeout(t);
  }, [linkNotice]);

  useEffect(() => {
    if (!linking) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLinking(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [linking]);

  const project = projects.find((p) => p.id === projectId);
  useSyncActiveEntity('project', project?.id, project?.name);
  const orderedSectionIds = useOrderedSectionIds(
    projectId ?? '',
    sections,
    sectionEdges
  );
  const sectionsById = useMemo(
    () => new Map(sections.map((s) => [s.id, s])),
    [sections]
  );

  const openTaskId = searchParams.get('taskId');
  const openTask = openTaskId ? tasks.find((t) => t.id === openTaskId) : null;

  if (!projectId || !project) {
    return (
      <div className="px-6 py-5">
        <EmptyState
          icon={FolderKanban}
          title="Project not found"
          hint="It may have been deleted."
        />
      </div>
    );
  }

  function handleSectionDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = orderedSectionIds.indexOf(active.id as Id);
    const newIndex = orderedSectionIds.indexOf(over.id as Id);
    reorderSections.mutate({
      orderedIds: arrayMove(orderedSectionIds, oldIndex, newIndex),
    });
  }

  // targetId vira previous/next de sourceId conforme a alça arrastada.
  function createLink(sourceId: Id, dir: LinkDir, targetId: Id) {
    const previousId = dir === 'prev' ? targetId : sourceId;
    const nextId = dir === 'prev' ? sourceId : targetId;
    if (
      seqEdges.some(
        (edge) =>
          edge.task_previous === previousId && edge.task_next === nextId
      )
    ) {
      setLinkNotice('Essas tarefas já estão ligadas nessa ordem.');
      return;
    }
    if (wouldCreateCycle(seqEdges, previousId, nextId)) {
      setLinkNotice('Isso criaria uma sequência circular.');
      return;
    }
    sequenceMutations.add.mutate({ previousId, nextId });
  }

  function toggleLink(taskId: Id, dir: LinkDir) {
    setLinking((current) =>
      current && current.taskId === taskId && current.dir === dir
        ? null
        : { taskId, dir }
    );
  }

  function handleDragStart(e: DragStartEvent) {
    const data = e.active.data.current as LinkDragData | undefined;
    if (data?.type === 'link') {
      setLinking(null);
      setActiveLinkDrag({ taskId: data.taskId, dir: data.dir });
    }
  }

  function handleDragEnd(e: DragEndEvent) {
    const data = e.active.data.current as LinkDragData | undefined;
    if (data?.type === 'link') {
      setActiveLinkDrag(null);
      const targetId = e.over?.data.current?.taskId as Id | undefined;
      if (targetId && targetId !== data.taskId) {
        createLink(data.taskId, data.dir, targetId);
      }
      return;
    }
    handleSectionDragEnd(e);
  }

  // Drag-and-drop is fiddly on touch — plain up/down moves cover the same
  // sections_sequence linked-list reorder without needing a precise drag.
  function moveSectionBy(index: number, delta: number) {
    const newIndex = index + delta;
    if (newIndex < 0 || newIndex >= orderedSectionIds.length) return;
    reorderSections.mutate({
      orderedIds: arrayMove(orderedSectionIds, index, newIndex),
    });
  }

  function addSection(e: React.FormEvent) {
    e.preventDefault();
    if (!newSectionName.trim()) return;
    createSection.mutate({
      project_id: projectId,
      name: newSectionName.trim(),
      status: 'planning',
    });
    setNewSectionName('');
  }

  function openTask_(task: Task) {
    if (linking) {
      if (task.id !== linking.taskId) {
        createLink(linking.taskId, linking.dir, task.id);
      }
      setLinking(null);
      return;
    }
    setSearchParams({ taskId: String(task.id) });
  }
  function closeTask() {
    searchParams.delete('taskId');
    setSearchParams(searchParams);
  }

  return (
    <div className="px-6 py-5">
      <div className="mb-5">
        <input
          value={project.name}
          onChange={(e) =>
            updateProject.mutate({
              id: projectId,
              patch: { name: e.target.value },
            })
          }
          className="font-display text-nyx-100 w-full bg-transparent text-display-lg focus:outline-none"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Select
            value={project.status}
            onChange={(e) =>
              updateProject.mutate({
                id: projectId,
                patch: { status: e.target.value as Status },
              })
            }
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace('_', ' ')}
              </option>
            ))}
          </Select>
          <Select
            value={project.priority || 'medium'}
            onChange={(e) =>
              updateProject.mutate({
                id: projectId,
                patch: { priority: e.target.value as Priority },
              })
            }
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
          <TextInput
            type="date"
            value={project.due ? project.due.slice(0, 10) : ''}
            onChange={(e) =>
              updateProject.mutate({
                id: projectId,
                patch: {
                  due: e.target.value
                    ? new Date(e.target.value).toISOString()
                    : null,
                },
              })
            }
            className="w-auto"
          />
          {project.doc_reference && (
            <a
              href={project.doc_reference}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-caption text-pontus-400 hover:underline"
            >
              <ExternalLink size={12} /> Docs
            </a>
          )}
          <button
            onClick={() =>
              removeProject.mutate(projectId, {
                onSuccess: () => navigate('/tasks'),
              })
            }
            className="text-nyx-500 hover:text-nyx-300 ml-auto flex items-center gap-1 text-caption"
          >
            <Trash2 size={13} /> Delete project
          </button>
        </div>

        <div className="mt-2 max-w-sm">
          <label className="text-nyx-500 mb-1 block text-caption font-medium">
            Target{' '}
            <span className="text-nyx-600 font-normal normal-case">
              (planned window — optional, must land before due)
            </span>
          </label>
          <TargetEditor
            value={project.target as string | null}
            due={project.due}
            onChange={(v) =>
              updateProject.mutate({ id: projectId, patch: { target: v } })
            }
          />
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveLinkDrag(null)}
      >
        <SortableContext
          items={orderedSectionIds}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {orderedSectionIds.map((sectionId, index) => {
              const section = sectionsById.get(sectionId);
              if (!section) return null;
              return (
                <SortableSectionWrapper key={sectionId} id={sectionId}>
                  {(dragHandleProps) => (
                    <SectionBlock
                      sectionId={sectionId}
                      section={section}
                      tasks={tasks}
                      onOpenTask={openTask_}
                      dragHandleProps={dragHandleProps}
                      onMoveUp={() => moveSectionBy(index, -1)}
                      onMoveDown={() => moveSectionBy(index, 1)}
                      canMoveUp={index > 0}
                      canMoveDown={index < orderedSectionIds.length - 1}
                      linking={linking}
                      onToggleLink={toggleLink}
                    />
                  )}
                </SortableSectionWrapper>
              );
            })}
          </div>
        </SortableContext>

        <DragOverlay dropAnimation={null}>
          {activeLinkDrag && (
            <span className="border-ink-600 bg-ink-800 text-ink-200 shadow-panel flex w-max items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs">
              {activeLinkDrag.dir === 'prev' ? (
                <CornerUpLeft size={12} className="text-teal-400" />
              ) : (
                <CornerDownRight size={12} className="text-teal-400" />
              )}
              {activeLinkDrag.dir === 'prev'
                ? 'Solte na tarefa que vem antes'
                : 'Solte na tarefa que vem depois'}
            </span>
          )}
        </DragOverlay>
      </DndContext>

      {!orderedSectionIds.length && (
        <EmptyState
          icon={FolderKanban}
          title="No sections yet"
          hint="Add a section below to start adding tasks."
        />
      )}

      <form
        onSubmit={addSection}
        className="border-nyx-700 mt-3 flex items-center gap-2 rounded-lg border border-dashed px-3 py-2"
      >
        <Plus size={14} className="text-nyx-600" />
        <input
          value={newSectionName}
          onChange={(e) => setNewSectionName(e.target.value)}
          placeholder="Add a section…"
          className="text-nyx-300 placeholder:text-nyx-600 flex-1 bg-transparent text-body focus:outline-none"
        />
      </form>

      {(linking || linkNotice) && (
        <div className="fixed bottom-4 left-1/2 z-20 -translate-x-1/2 px-4">
          <div className="border-ink-600 bg-ink-800 shadow-panel flex items-center gap-2.5 rounded-full border px-3.5 py-2 text-xs">
            {linkNotice ? (
              <span className="text-rust-500">{linkNotice}</span>
            ) : (
              <>
                {linking!.dir === 'prev' ? (
                  <CornerUpLeft size={12} className="shrink-0 text-teal-400" />
                ) : (
                  <CornerDownRight
                    size={12}
                    className="shrink-0 text-teal-400"
                  />
                )}
                <span className="text-ink-200">
                  Toque na tarefa que vem{' '}
                  {linking!.dir === 'prev' ? 'antes' : 'depois'} de “
                  {tasks.find((t) => t.id === linking!.taskId)?.name}”
                </span>
                <button
                  onClick={() => setLinking(null)}
                  className="text-ink-500 hover:text-ink-200 shrink-0"
                >
                  cancelar
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {openTask && (
        <TaskDetailModal
          key={openTask.id}
          taskId={openTask.id}
          task={openTask}
          onClose={closeTask}
          onOpenTask={openTask_}
        />
      )}
    </div>
  );
}
