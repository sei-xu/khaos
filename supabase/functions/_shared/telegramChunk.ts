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

// Makes a slice of rendered HTML safe to send on its own. findChunkEnd
// prefers a boundary that isn't inside a tag or entity, but it can't always
// find one, and even a boundary it considers clean can fall between an
// `<a href="...">` and its `</a>` — nothing is "inside a tag" in the middle
// of a link's label. Telegram answers 400 ("can't parse entities") for an
// unclosed start tag and tg() only logs it, so that slice is dropped
// outright rather than shortened: for a truncated reply (telegram.ts's
// HTML_TRUNCATE_CHARS) that means the whole answer never arrives.
//
// So repair the slice instead of trusting the boundary: drop a half-written
// tag or entity at the very end, then close any `<a>` whose `</a>` fell on
// the other side of the cut. Only `<a>` is handled because that is the only
// element renderTelegramMessage emits (telegramRender.ts); everything else
// in the text is escaped.
export function repairHtmlCut(chunk: string): string {
  let out = chunk;
  const lastLt = out.lastIndexOf('<');
  if (lastLt > out.lastIndexOf('>')) out = out.slice(0, lastLt);
  const lastAmp = out.lastIndexOf('&');
  if (
    lastAmp !== -1 &&
    out.length - lastAmp <= 10 &&
    out.lastIndexOf(';') < lastAmp
  ) {
    out = out.slice(0, lastAmp);
  }
  const opens = (out.match(/<a\b/g) ?? []).length;
  const closes = (out.match(/<\/a>/g) ?? []).length;
  if (opens > closes) out += '</a>'.repeat(opens - closes);
  return out;
}
