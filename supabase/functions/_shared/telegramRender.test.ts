import { describe, it, expect } from 'vitest';
import {
  escapeHtml,
  buildInlineKeyboard,
  renderTelegramMessage,
} from './telegramRender';

describe('escapeHtml', () => {
  it('escapes &, < and > before they reach the HTML parse_mode', () => {
    expect(escapeHtml('a & b < c > d')).toBe('a &amp; b &lt; c &gt; d');
  });
});

describe('renderTelegramMessage', () => {
  it('turns a resolved entity token into an <a href> with the right URL per type', async () => {
    const resolveEntity = async (type: string, id: string) => {
      if (type === 'task' && id === 'aaaaaaaa') return { name: 'Write report' };
      return null;
    };
    const { text } = await renderTelegramMessage(
      'Created. [[task:aaaaaaaa]]',
      { appUrl: 'https://khaos.example', resolveEntity }
    );
    expect(text).toBe(
      'Created. <a href="https://khaos.example/tasks?taskId=aaaaaaaa">Write report</a>'
    );
  });

  it('builds a project URL by type', async () => {
    const resolveEntity = async () => ({ name: 'Theurgy' });
    const { text } = await renderTelegramMessage('[[project:bbbbbbbb]]', {
      appUrl: 'https://khaos.example',
      resolveEntity,
    });
    expect(text).toBe(
      '<a href="https://khaos.example/projects/bbbbbbbb">Theurgy</a>'
    );
  });

  it('builds a section URL from the resolved project id, not a /sections route', async () => {
    const resolveEntity = async () => ({ name: 'Chapter 1', projectId: 'dddddddd' });
    const { text } = await renderTelegramMessage('[[section:cccccccc]]', {
      appUrl: 'https://khaos.example',
      resolveEntity,
    });
    expect(text).toBe(
      '<a href="https://khaos.example/projects/dddddddd">Chapter 1</a>'
    );
  });

  it('escapes the model text around a token', async () => {
    const resolveEntity = async () => ({ name: 'A & B' });
    const { text } = await renderTelegramMessage(
      '<script> [[task:aaaaaaaa]] a < b',
      { appUrl: 'https://khaos.example', resolveEntity }
    );
    expect(text).toBe(
      '&lt;script&gt; <a href="https://khaos.example/tasks?taskId=aaaaaaaa">A &amp; B</a> a &lt; b'
    );
  });

  it('strips a token whose id does not resolve, same as the pre-existing stripTokens fallback', async () => {
    const resolveEntity = async () => null;
    const { text } = await renderTelegramMessage(
      'See [[task:aaaaaaaa]] now',
      { appUrl: 'https://khaos.example', resolveEntity }
    );
    expect(text).toBe('See  now');
  });

  it('never emits a link when no KHAOS_APP_URL is configured', async () => {
    const resolveEntity = async () => ({ name: 'Write report' });
    const { text } = await renderTelegramMessage(
      'See [[task:aaaaaaaa]] now',
      { appUrl: null, resolveEntity }
    );
    expect(text).toBe('See  now');
    expect(text).not.toContain('<a href');
  });

  it('pulls a confirm token out of the text and returns its options separately', async () => {
    const { text, options } = await renderTelegramMessage(
      'Confirm? [[confirm: Criar | Cancelar]]',
      { appUrl: null, resolveEntity: async () => null }
    );
    expect(text).toBe('Confirm?');
    expect(options).toEqual(['Criar', 'Cancelar']);
  });
});

describe('buildInlineKeyboard', () => {
  it('builds one button per option, one row each', () => {
    const { inline_keyboard } = buildInlineKeyboard(['Criar', 'Cancelar']);
    expect(inline_keyboard).toEqual([
      [{ text: 'Criar', callback_data: 'c:Criar' }],
      [{ text: 'Cancelar', callback_data: 'c:Cancelar' }],
    ]);
  });

  it('keeps callback_data within the 64-byte Telegram limit', () => {
    const short = 'Confirm';
    const { inline_keyboard } = buildInlineKeyboard([short]);
    const bytes = new TextEncoder().encode(inline_keyboard[0][0].callback_data);
    expect(bytes.length).toBeLessThanOrEqual(64);
  });

  it('drops the button (falling back to "reply by text") for an option whose callback_data would exceed 64 bytes', () => {
    const tooLong = 'x'.repeat(70);
    const { inline_keyboard, textFallbackOptions } = buildInlineKeyboard([
      'Short',
      tooLong,
    ]);
    expect(inline_keyboard).toEqual([[{ text: 'Short', callback_data: 'c:Short' }]]);
    expect(textFallbackOptions).toEqual([tooLong]);
  });
});
