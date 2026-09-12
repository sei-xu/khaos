import { useEffect, useRef, useState } from 'react';
import { Send, Trash2, User, Loader2, X, Link2 } from 'lucide-react';
import clsx from 'clsx';
import { useChatAgent, type ChatMessage } from '../../hooks/useChatAgent';
import { useActiveEntity } from '../../lib/activeEntityContext';
import { parseMessageSegments } from '../../lib/chat/entityRefs';
import { EntityChip } from './EntityChip';
import KhaosIcon from '../common/KhaosIcon';
import KhaoticText from '../common/KhaoticText';

const MAX_TEXTAREA_LINES = 5;

function MessageContent({ text }: { text: string }) {
  const segments = parseMessageSegments(text);
  return (
    <>
      {segments.map((seg, i) =>
        seg.type === 'entity' ? (
          <EntityChip key={i} entityType={seg.entityType} id={seg.id} />
        ) : (
          seg.value && (
            <span key={i} className="whitespace-pre-wrap">
              {seg.value}
            </span>
          )
        )
      )}
    </>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
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
          'max-w-[85%] rounded-lg px-4 py-2 text-body leading-relaxed',
          isUser ? 'bg-nyx-700 text-nyx-100' : 'bg-nyx-800 text-nyx-200',
          message.isError &&
            'text-tartarus-400 border-tartarus-500/40 bg-tartarus-500/10 border'
        )}
      >
        <MessageContent text={message.text} />
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
 * bottom-sheet, and the standalone /assistant route.
 */
export default function ChatPanel({
  onRequestClose,
}: {
  onRequestClose?: () => void;
}) {
  const { messages, sendMessage, isSending, clearHistory } = useChatAgent();
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

  async function submit() {
    if (!input.trim() || isSending) return;
    const toSend = input;
    setInput('');
    sendMessage(toSend);
  }

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
        className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4"
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
          <MessageBubble key={m.id} message={m} />
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
          disabled={isSending}
          className="border-nyx-700 bg-nyx-800 text-nyx-100 placeholder:text-nyx-500 focus:border-eros-400 flex-1 resize-none rounded border px-4 py-2 text-body leading-normal focus:outline-hidden disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={isSending || !input.trim()}
          className="bg-eros-500 text-nyx-900 hover:bg-eros-400 flex h-10 w-10 shrink-0 items-center justify-center rounded-full disabled:opacity-40"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
