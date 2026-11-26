// Tokens que o assistente pode emitir na resposta final:
//  - entidade real já persistida, ex: "[[task:3fa8...]]" — o ChatPanel troca
//    por um chip formatado (EntityChip) em vez de descrever em prosa.
//  - confirmação com botões, ex: "[[confirm: Criar | Cancelar]]" — o
//    ChatPanel renderiza um botão por opção; o clique manda o label da
//    opção como o próximo turno (ver prompts.ts / useChatAgent.ts).

export type ChatEntityType = 'task' | 'project' | 'event' | 'section';

export interface TextSegment {
  type: 'text';
  value: string;
}

export interface EntitySegment {
  type: 'entity';
  entityType: ChatEntityType;
  id: string;
}

export interface ConfirmSegment {
  type: 'confirm';
  options: string[];
}

export type MessageSegment = TextSegment | EntitySegment | ConfirmSegment;

const TOKEN_RE =
  /\[\[(task|project|event|section):([0-9a-fA-F-]{8,})\]\]|\[\[confirm:([^\]]*)\]\]/g;

// Splits a confirm token's body on "|", honouring "\|" as a literal pipe
// inside an option (so an option can itself read "A | B").
function splitConfirmOptions(body: string): string[] {
  const parts: string[] = [];
  let current = '';
  for (let i = 0; i < body.length; i++) {
    if (body[i] === '\\' && body[i + 1] === '|') {
      current += '|';
      i++;
      continue;
    }
    if (body[i] === '|') {
      parts.push(current);
      current = '';
      continue;
    }
    current += body[i];
  }
  parts.push(current);
  return parts.map((p) => p.trim()).filter(Boolean);
}

export function parseMessageSegments(text: string): MessageSegment[] {
  const segments: MessageSegment[] = [];
  let lastIndex = 0;
  // Buffers plain text across a dropped/invalid token instead of flushing a
  // text segment on every regex match, so e.g. "text [[confirm:]] more"
  // (an empty confirm — no usable options) collapses into one segment
  // rather than splitting around a token that renders nothing.
  let textBuffer = '';

  for (const match of text.matchAll(TOKEN_RE)) {
    const index = match.index ?? 0;
    textBuffer += text.slice(lastIndex, index);
    lastIndex = index + match[0].length;

    const [, entityType, id, confirmBody] = match;
    if (entityType && id) {
      if (textBuffer) {
        segments.push({ type: 'text', value: textBuffer });
        textBuffer = '';
      }
      segments.push({
        type: 'entity',
        entityType: entityType as ChatEntityType,
        id,
      });
      continue;
    }

    // confirmBody can be '' for "[[confirm:]]" — matchAll still finds it.
    const options = splitConfirmOptions(confirmBody ?? '');
    if (!options.length) continue; // dropped: no usable options
    if (textBuffer) {
      segments.push({ type: 'text', value: textBuffer });
      textBuffer = '';
    }
    segments.push({ type: 'confirm', options });
  }

  textBuffer += text.slice(lastIndex);
  if (textBuffer) segments.push({ type: 'text', value: textBuffer });

  return segments;
}
