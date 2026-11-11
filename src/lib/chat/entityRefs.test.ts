import { describe, it, expect } from 'vitest';
import { parseMessageSegments } from './entityRefs';

// Retroactive coverage, added alongside the section token and the confirm
// token (chat-improvements backlog item): the parser now has four entity
// types plus a non-entity confirm token, and had no test at all before this.
// A regression here (a malformed token silently rendering as a chip, or a
// confirm token's options getting mis-split) would be silent in the UI —
// the chip/button just looks wrong — so it earns a test now rather than
// waiting for a bug report.

describe('parseMessageSegments', () => {
  it('parses a single entity token with surrounding text', () => {
    const segments = parseMessageSegments('Created. [[task:abc123de]] Done.');
    expect(segments).toEqual([
      { type: 'text', value: 'Created. ' },
      { type: 'entity', entityType: 'task', id: 'abc123de' },
      { type: 'text', value: ' Done.' },
    ]);
  });

  it('parses the section entity type', () => {
    const segments = parseMessageSegments('[[section:abc12345]]');
    expect(segments).toEqual([
      { type: 'entity', entityType: 'section', id: 'abc12345' },
    ]);
  });

  it('parses multiple mixed entity tokens in order', () => {
    const segments = parseMessageSegments(
      '[[task:11111111]] and [[project:22222222]] and [[event:33333333]]'
    );
    expect(segments.filter((s) => s.type === 'entity')).toEqual([
      { type: 'entity', entityType: 'task', id: '11111111' },
      { type: 'entity', entityType: 'project', id: '22222222' },
      { type: 'entity', entityType: 'event', id: '33333333' },
    ]);
  });

  it('does not treat a malformed token (unknown type) as an entity', () => {
    const segments = parseMessageSegments('[[widget:abc12345]]');
    expect(segments).toEqual([{ type: 'text', value: '[[widget:abc12345]]' }]);
  });

  it('does not treat a short/non-UUID id as an entity', () => {
    const segments = parseMessageSegments('[[task:123]]');
    expect(segments).toEqual([{ type: 'text', value: '[[task:123]]' }]);
  });

  it('parses a confirm token with its options', () => {
    const segments = parseMessageSegments(
      'Which one? [[confirm: Criar | Trocar seção | Cancelar]]'
    );
    expect(segments).toEqual([
      { type: 'text', value: 'Which one? ' },
      {
        type: 'confirm',
        options: ['Criar', 'Trocar seção', 'Cancelar'],
      },
    ]);
  });

  it('trims whitespace around each confirm option', () => {
    const segments = parseMessageSegments('[[confirm:  Sim  |  Não  ]]');
    expect(segments).toEqual([
      { type: 'confirm', options: ['Sim', 'Não'] },
    ]);
  });

  it('supports an escaped pipe inside a confirm option', () => {
    const segments = parseMessageSegments(
      '[[confirm: A \\| B | Cancelar]]'
    );
    expect(segments).toEqual([
      { type: 'confirm', options: ['A | B', 'Cancelar'] },
    ]);
  });

  it('drops a confirm token with no options', () => {
    const segments = parseMessageSegments('text [[confirm:]] more');
    expect(segments).toEqual([{ type: 'text', value: 'text  more' }]);
  });
});
