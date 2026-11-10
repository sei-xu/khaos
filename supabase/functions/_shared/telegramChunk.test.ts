import { describe, it, expect } from 'vitest';
import { findChunkEnd, repairHtmlCut } from './telegramChunk';

describe('findChunkEnd', () => {
  it('returns the text length when it already fits', () => {
    expect(findChunkEnd('short', 100)).toBe(5);
  });

  it('prefers the last space before the limit over a hard cut', () => {
    const text = 'aaaa bbbb cccc';
    expect(findChunkEnd(text, 12)).toBe(10); // "aaaa bbbb " — up to and including the space
  });

  it('never splits inside an <a href="..."> tag', () => {
    const text = `x${'y'.repeat(8)}<a href="https://example.com/very/long/path">label</a>z`;
    const end = findChunkEnd(text, 20);
    const before = text.slice(0, end);
    const openTags = (before.match(/</g) ?? []).length;
    const closeTags = (before.match(/>/g) ?? []).length;
    expect(openTags).toBe(closeTags);
  });

  it('never splits inside an &amp; entity', () => {
    const text = `${'x'.repeat(18)}&amp;${'y'.repeat(20)}`;
    const end = findChunkEnd(text, 20);
    const before = text.slice(0, end);
    expect(before.includes('&') ? before.includes('&amp;') : true).toBe(true);
  });
});

describe('repairHtmlCut', () => {
  it('closes an <a> whose </a> fell past the cut', () => {
    // The shape a truncated reply hits: the limit lands in the middle of a
    // link label, where findChunkEnd sees nothing "inside a tag" and cuts.
    const full = `<a href="https://example.com/p">Nome bem comprido da task</a> resto`;
    const end = findChunkEnd(full, 40);
    expect(repairHtmlCut(full.slice(0, end))).toBe(
      '<a href="https://example.com/p">Nome </a>'
    );
  });

  it('drops a half-written tag at the end', () => {
    expect(repairHtmlCut('texto <a href="https://exa')).toBe('texto ');
  });

  it('drops a half-written entity at the end', () => {
    expect(repairHtmlCut('a &amp; b &a')).toBe('a &amp; b ');
  });

  it('leaves well-formed HTML untouched', () => {
    const ok = 'feito: <a href="https://example.com/p">Task</a> &amp; mais';
    expect(repairHtmlCut(ok)).toBe(ok);
  });
});
