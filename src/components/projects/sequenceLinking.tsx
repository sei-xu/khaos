// Criação de sequências direto da lista de tarefas de uma seção: cada row
// ganha alças "previous"/"next" que podem ser arrastadas até outra tarefa
// (a tarefa-alvo vira a anterior/seguinte da origem) ou tocadas para armar
// o modo de ligação — o próximo toque em uma tarefa cria a relação, o que
// cobre touch, onde arrastar é impreciso. O DndContext e a efetivação da
// aresta ficam na ProjectDetailPage.
import type { ReactNode } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CornerUpLeft, CornerDownRight } from 'lucide-react';
import clsx from 'clsx';
import type { Id } from '../../lib/types';

export type LinkDir = 'prev' | 'next';

export interface LinkingState {
  taskId: Id;
  dir: LinkDir;
}

export interface LinkDragData {
  type: 'link';
  taskId: Id;
  dir: LinkDir;
}

interface LinkHandleProps {
  taskId: Id;
  dir: LinkDir;
  armed: boolean;
  onToggle: () => void;
}

function LinkHandle({ taskId, dir, armed, onToggle }: LinkHandleProps) {
  const { setNodeRef, listeners, attributes } = useDraggable({
    id: `link-${dir}:${taskId}`,
    data: { type: 'link', taskId, dir } satisfies LinkDragData,
  });
  const Icon = dir === 'prev' ? CornerUpLeft : CornerDownRight;
  return (
    <button
      ref={setNodeRef}
      style={{ touchAction: 'none' }}
      {...listeners}
      {...attributes}
      onClick={onToggle}
      title={
        dir === 'prev'
          ? 'Ligar à tarefa anterior: arraste até ela, ou toque aqui e depois nela'
          : 'Ligar à tarefa seguinte: arraste até ela, ou toque aqui e depois nela'
      }
      className={clsx(
        'flex size-5 cursor-grab items-center justify-center rounded active:cursor-grabbing',
        armed
          ? 'bg-teal-500/20 text-teal-400'
          : 'text-ink-600 hover:bg-ink-700 hover:text-ink-300'
      )}
    >
      <Icon size={12} />
    </button>
  );
}

interface SequenceLinkControlsProps {
  taskId: Id;
  linking: LinkingState | null;
  onToggleLink: (taskId: Id, dir: LinkDir) => void;
}

export function SequenceLinkControls({
  taskId,
  linking,
  onToggleLink,
}: SequenceLinkControlsProps) {
  const armedHere = linking?.taskId === taskId;
  return (
    <span
      className={clsx(
        'flex shrink-0 items-center gap-0.5 self-start pt-1 pl-1 transition-opacity',
        // Em ponteiros precisos as alças só aparecem no hover da row (ou
        // enquanto o modo de ligação está armado); no touch ficam visíveis.
        !armedHere &&
          'pointer-fine:opacity-0 pointer-fine:group-hover/row:opacity-100 pointer-fine:focus-within:opacity-100'
      )}
    >
      <LinkHandle
        taskId={taskId}
        dir="prev"
        armed={armedHere && linking!.dir === 'prev'}
        onToggle={() => onToggleLink(taskId, 'prev')}
      />
      <LinkHandle
        taskId={taskId}
        dir="next"
        armed={armedHere && linking!.dir === 'next'}
        onToggle={() => onToggleLink(taskId, 'next')}
      />
    </span>
  );
}

interface TaskDropTargetProps {
  taskId: Id;
  armedSource: boolean;
  children: ReactNode;
}

export function TaskDropTarget({
  taskId,
  armedSource,
  children,
}: TaskDropTargetProps) {
  const { setNodeRef, isOver, active } = useDroppable({
    id: `task-drop:${taskId}`,
    data: { type: 'task', taskId },
  });
  const activeLink = active?.data.current as LinkDragData | undefined;
  const hovering =
    isOver && activeLink?.type === 'link' && activeLink.taskId !== taskId;
  return (
    <div
      ref={setNodeRef}
      data-task-id={taskId}
      className={clsx(
        'rounded-md',
        hovering && 'ring-1 ring-teal-400/80',
        armedSource && 'ring-1 ring-teal-500/40'
      )}
    >
      {children}
    </div>
  );
}
