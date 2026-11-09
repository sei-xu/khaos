import { useEffect, useRef, useState } from 'react';
import {
  Send,
  Trash2,
  User,
  Loader2,
  X,
  Link2,
  CheckCircle2,
  PlusCircle,
  Trash,
  Star,
  ListPlus,
  Activity,
} from 'lucide-react';
import clsx from 'clsx';
import type { ChatMessage } from '../../hooks/useChatAgent';
import { useChatAgentContext } from '../../lib/chat/chatAgentContext';
import { useActiveEntity } from '../../lib/activeEntityContext';
import { parseMessageSegments } from '../../lib/chat/entityRefs';
import type { DbChangeItem } from '../../lib/chat/turnPrefix';
import { EntityChip } from './EntityChip';
import KhaosIcon from '../common/KhaosIcon';
import KhaoticText from '../common/KhaoticText';

const MAX_TEXTAREA_LINES = 5;

function MessageContent({
  text,
  onConfirm,
}: {
  text: string;
  onConfirm?: (label: string) => void;
}) {
  const segments = parseMessageSegments(text);
  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === 'entity') {
          return <EntityChip key={i} entityType={seg.entityType} id={seg.id} />;
        }
        if (seg.type === 'confirm') {
          return (
            <div key={i} className="my-1 flex flex-wrap gap-1.5">
              {seg.options.map((option) => (
                <button
                  key={option}
                  onClick={() => onConfirm?.(option)}
                  className="border-eros-500/40 text-eros-300 hover:bg-eros-500/15 rounded-full border px-3 py-1 text-caption font-medium"
                >
                  {option}
                </button>
              ))}
            </div>
          );
        }
        return (
          seg.value && (
            <span key={i} className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
              {seg.value}
            </span>
          )
        );
      })}
    </>
  );
}

// Human phrase for each moment type/transition in a [DB Change: ...] batch —
// see turnPrefix.ts's parseDbChangeItems. Falls back to the raw moment type
// for anything not called out explicitly (due/estimate/priority/renamed/
// moved/item/note etc.), which still reads fine next to the entity chip.
function describeMoment(item: DbChangeItem): { icon: typeof Activity; phrase: string } {
  if (item.momentType === 'status') {
    if (item.transition?.endsWith('done')) {
      return { icon: CheckCircle2, phrase: 'concluiu' };
    }
    if (item.transition?.endsWith('cancelled')) {
      return { icon: Trash, phrase: 'cancelou' };
    }
    return { icon: Activity, phrase: 'atualizou o status de' };
  }
  switch (item.momentType) {
    case 'created':
      return { icon: PlusCircle, phrase: 'criou' };
    case 'deleted':
      return { icon: Trash, phrase: 'removeu' };
    case 'today':
      return { icon: Star, phrase: 'marcou para hoje' };
    case 'backlog':
      return { icon: ListPlus, phrase: 'adicionou ao backlog' };
    default:
      return { icon: Activity, phrase: item.momentType };
  }
}

// Renders a settled out-of-chat DB change as a formatted activity line
// (icon + human phrase + entity chip) instead of a raw user bubble. Before
// this, these turns were hidden by stripping a "[DB Change: ...]" prefix
// with a regex anchored on the first "]" — which left residue behind as
// unreadable UUID-laden text when a batch had more than one moment (see
// turnPrefix.ts).
function ActivityLine({ items }: { items: DbChangeItem[] }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-col gap-1 pl-9">
      {items.map((item, i) => {
        const { icon: Icon, phrase } = describeMoment(item);
        const entityType =
          item.entityType === 'task' ||
          item.entityType === 'project' ||
          item.entityType === 'section' ||
          item.entityType === 'event'
            ? item.entityType
            : null;
        return (
          <div
            key={i}
            className="text-nyx-500 flex min-w-0 items-center gap-1.5 text-caption"
          >
            <Icon size={12} className="shrink-0" />
            <span className="shrink-0">{phrase}</span>
            {entityType ? (
              <div className="min-w-0 flex-1">
                <EntityChip entityType={entityType} id={item.entityId} />
              </div>
            ) : (
              <span className="truncate">{item.entityId}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MessageBubble({
  message,
  onConfirm,
}: {
  message: ChatMessage;
  onConfirm: (label: string) => void;
}) {
  const isUser = message.role === 'user';

  if (message.kind === 'activity') {
    return <ActivityLine items={message.activityItems ?? []} />;
  }

  return (
    <div className={clsx('flex gap-2', isUser && 'flex-row-reverse')}>
      {isUser ? (
        <div className="bg-nyx-700 text-nyx-200 flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
          <User size={14} />
        </div>
      ) : (
        <KhaosIcon
          size="h-7 w-7"
          bgColor="bg-eros-500/15"
          color="text-eros-400"
          spin={false}
        />
      )}
      <div
        className={clsx(
          'max-w-[85%] min-w-0 rounded-lg px-4 py-2 text-body leading-relaxed',
          isUser ? 'bg-nyx-700 text-nyx-100' : 'bg-nyx-800 text-nyx-200',
          message.isError &&
            'text-tartarus-400 border-tartarus-500/40 bg-tartarus-500/10 border',
          message.pending && 'opacity-50'
        )}
      >
        <MessageContent text={message.text} onConfirm={onConfirm} />
        {message.pending && (
          <div className="text-nyx-500 mt-1 text-label tracking-wide uppercase">
            Na fila…
          </div>
        )}
      </div>
    </div>
  );
}

// Resizes a textarea to fit its content, up to `maxLines` — beyond that it
// stops growing and becomes internally scrollable instead.
function autoResizeTextarea(el: HTMLTextAreaElement, maxLines: number) {
  const style = getComputedStyle(el);
  const lineHeight = parseFloat(style.lineHeight) || 20;
  const paddingTop = parseFloat(style.paddingTop) || 0;
  const paddingBottom = parseFloat(style.paddingBottom) || 0;
  const borderTop = parseFloat(style.borderTopWidth) || 0;
  const borderBottom = parseFloat(style.borderBottomWidth) || 0;
  const maxHeight =
    lineHeight * maxLines +
    paddingTop +
    paddingBottom +
    borderTop +
    borderBottom;

  el.style.height = 'auto';
  const contentHeight = el.scrollHeight;
  el.style.height = `${Math.min(contentHeight, maxHeight)}px`;
  el.style.overflowY = contentHeight > maxHeight ? 'auto' : 'hidden';
}

/**
 * Shared chat UI — used as the persistent desktop sidebar, the mobile
 * bottom-sheet, and the standalone /assistant route. Several of these can be
 * mounted at once (the desktop rail stays mounted on mobile too), so it's a
 * view over the shell's single agent, never an owner of one.
 */
export default function ChatPanel({
  onRequestClose,
}: {
  onRequestClose?: () => void;
}) {
  const { messages, sendMessage, isSending, clearHistory } =
    useChatAgentContext();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { activeEntity, clearActiveEntity } = useActiveEntity();

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages]);

  // Grow/shrink the textarea as the person types, capped at MAX_TEXTAREA_LINES.
  useEffect(() => {
    if (textareaRef.current) {
      autoResizeTextarea(textareaRef.current, MAX_TEXTAREA_LINES);
    }
  }, [input]);

  // No longer gated on isSending — sendMessage always accepts now and
  // queues the turn (turnQueue.ts) instead of discarding it mid-turn.
  function submit() {
    if (!input.trim()) return;
    const toSend = input;
    setInput('');
    sendMessage(toSend);
  }

  // Confirmation buttons ([[confirm: ...]] tokens, entityRefs.ts) only fire
  // on the most recent assistant message — stale buttons left over from an
  // earlier turn must not be clickable, or the same confirmation could be
  // re-executed twice.
  const lastModelMessageId = [...messages]
    .reverse()
    .find((m) => m.role === 'model')?.id;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submit();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Cmd/Ctrl+Enter sends. Plain Enter just inserts a newline (default behavior).
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-nyx-700 flex shrink-0 items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-nyx-100 text-body font-semibold">
            <KhaoticText text="@KhaosFacitBot" />
          </h2>
        </div>
        <div className="flex items-center gap-3">
          {messages.length > 0 && (
            <button
              onClick={clearHistory}
              className="text-nyx-500 hover:text-tartarus-500 flex items-center gap-1 text-caption"
            >
              <Trash2 size={12} /> Clear
            </button>
          )}
          {onRequestClose && (
            <button
              onClick={onRequestClose}
              className="text-nyx-500 hover:text-nyx-200"
              aria-label="Close chat"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {activeEntity && (
        <div className="border-nyx-700 bg-nyx-800/50 flex shrink-0 items-center gap-1.5 border-b px-4 py-1.5 text-caption">
          <Link2 size={11} className="text-eros-400 shrink-0" />
          <span className="text-nyx-500 shrink-0">Talking about:</span>
          <span className="text-nyx-100 min-w-0 flex-1 truncate font-medium">
            {activeEntity.name}
          </span>
          <span className="text-nyx-600 shrink-0 text-label tracking-wide uppercase">
            {activeEntity.type}
          </span>
          <button
            onClick={() => clearActiveEntity(activeEntity.id)}
            className="text-nyx-500 hover:text-tartarus-500 shrink-0"
            aria-label="Detach from chat"
            title="Stop referencing this in chat"
          >
            <X size={12} />
          </button>
        </div>
      )}

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto p-4"
      >
        {!messages.length && (
          <div className="text-nyx-600 flex h-full flex-col items-center justify-center gap-2 text-center">
            <KhaosIcon size="h-10 w-10" bgColor="bg-transparent" spin={true} />
            <p className="text-body">
              Try: &ldquo;What&lsquo;s overdue?&rdquo; — or open a task and ask
              about it directly.
            </p>
          </div>
        )}
        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            onConfirm={(label) => m.id === lastModelMessageId && sendMessage(label)}
          />
        ))}

        {isSending && (
          <div className="text-nyx-500 flex items-center gap-2 pl-9 text-caption">
            <Loader2 size={13} className="animate-spin" /> Thinking…
          </div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="border-nyx-700 flex shrink-0 items-end gap-2 border-t p-3"
      >
        <textarea
          ref={textareaRef}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Khaos… (⌘+Enter to send)"
          // text-base (16px) below lg: iOS Safari zooms the viewport on
          // focusing any input with font-size < 16px, which is what made
          // the textarea "expand to 100% of the screen" on focus and left
          // the whole layout with horizontal scroll. The 14px design token
          // (--text-body) is restored from lg: up, where no mobile browser
          // does this.
          className="border-nyx-700 bg-nyx-800 text-nyx-100 placeholder:text-nyx-500 focus:border-eros-400 flex-1 resize-none rounded border px-4 py-2 text-base leading-normal focus:outline-hidden lg:text-body"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="bg-eros-500 text-nyx-900 hover:bg-eros-400 flex h-10 w-10 shrink-0 items-center justify-center rounded-full disabled:opacity-40"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
