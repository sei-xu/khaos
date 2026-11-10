// Pure text-chunking helpers for telegram.ts's sendMessage, split out so
// they're unit-testable without Deno globals (telegram.ts reads
// Deno.env.get at module scope) — mirrors telegramRender.ts being kept pure
// for the same reason.

// True when `idx` falls inside an HTML tag ("<a href=...>") or entity
// ("&amp;") that renderTelegramMessage (telegramRender.ts) can emit — used
// to keep both truncation and chunking from splitting one in half, which
// makes Telegram reject the whole chunk with "can't parse entities", not
// just mangle a word.
export function isInsideTagOrEntity(text: string, idx: number): boolean {
  const upto = text.slice(0, idx);
  const lastLt = upto.lastIndexOf('<');
  const lastGt = upto.lastIndexOf('>');
  if (lastLt > lastGt) return true;
  const lastAmp = upto.lastIndexOf('&');
  if (lastAmp !== -1 && idx - lastAmp <= 10 && !upto.slice(lastAmp).includes(';')) {
    return true;
  }
  return false;
}

// Finds the best place at or before `maxLen` to end a chunk: the last
// newline or space that isn't inside a tag/entity, falling back to a hard
// cut nudged earlier if even that lands inside one.
export function findChunkEnd(text: string, maxLen: number): number {
  if (text.length <= maxLen) return text.length;
  for (let i = maxLen; i > 0; i--) {
    const ch = text[i - 1];
    if ((ch === '\n' || ch === ' ') && !isInsideTagOrEntity(text, i)) {
      return i;
    }
  }
  let end = maxLen;
  while (end > 0 && isInsideTagOrEntity(text, end)) end--;
  return end || maxLen;
}
