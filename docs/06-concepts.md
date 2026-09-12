# Khaos — Conceitos

## Status

Vocabulário unificado para `tasks`, `sections` e `projects`. Cada entidade
usa os que fazem sentido no seu contexto, mas o enum `status` é único e
compartilhado.

| Status | Significado |
| --- | --- |
| `planning` | Existe mas não está pronta para começar |
| `todo` | Pronta para ser feita |
| `in_progress` | Em andamento |
| `in_review` | Aguardando avaliação externa — cliente, feedback |
| `done` | Concluída |
| `paused` | Pausada temporariamente |
| `cancelled` | Cancelada — não será feita |
| `waiting` | Bloqueada por uma dependência de sequência ainda não resolvida |

`waiting` é aplicado automaticamente quando uma `tasks_sequence`/
`sections_sequence` é criada apontando para o item, e removido (→ `todo`)
por trigger assim que a dependência anterior é concluída ou cancelada —
não é um estado que o usuário ou a IA define diretamente.

Mudar o status de um `project`/`section` propaga por cascata: concluir ou
cancelar arrasta as `sections`/`tasks` filhas não terminadas junto (exceto
as já `done`/`cancelled`), e sair de `planning` para `todo` promove os
filhos que ainda estavam em `planning`.

**Quem gerencia:** tanto a UI quanto a IA escrevem status diretamente na
linha (não há um endpoint dedicado de status — a IA usa a tool genérica
`update_rows`). O vocabulário é garantido pelo próprio enum do Postgres, que
rejeita qualquer valor fora da lista.

---

## Registro de tempo

O tempo é registrado em duas camadas complementares:

**`task_logs`** — o dado objetivo. Um intervalo `[started_at, ended_at)`
(coluna `duration`, `tstzrange`), aberto enquanto ativo. Não implica
conclusão da tarefa. Pode não ter `task_id` (trabalho fora da hierarquia —
ver `note`/`project_id` em [Banco de dados](01-database.md#task_logs)), e
pode ser `background` (roda em paralelo a outros logs, em vez de competir
pelo único slot "foreground").

**`moments`** — o dado contextual. O que aconteceu, por quê, como o usuário
estava.

### Fluxo

```
"vou começar X"
  → task_log criado (duration aberto)
  → moment: started
  → status da task vira in_progress (se ainda não era)

"parei por hoje"
  → task_log fechado (duration.upper = now())
  → moment: stopped
  → tarefa NÃO muda de status

"terminei X"
  → task_log fechado
  → moment: stopped
  → status atualizado para done (ação separada)
  → moment: status = done
```

**Parar o timer ≠ concluir a tarefa.** São ações distintas e independentes —
encerrar um `task_log` nunca muda `status` sozinho.

---

## Eventos de momento (`moment_types`)

Os moments são registrados por dois "autores" com responsabilidades
distintas (coluna `authored_by`: `user`, `system`, `assistant`,
`ai_backfill`):

### Gerados automaticamente pelo banco (triggers)

| Evento | Quando |
| --- | --- |
| `created` | Qualquer entidade é criada |
| `due` | Prazo é definido ou alterado |
| `estimate` | Estimativa é definida ou alterada (tasks) |
| `priority` | Prioridade é definida ou alterada |
| `status` | Status muda |
| `started` | Um `task_log` é aberto para uma tarefa |
| `stopped` | Um `task_log` é fechado |
| `scheduled` | Um `event` é criado ou tem sua janela alterada |
| `target` | A janela planejada (`target`) muda |

### Escritos por usuário ou IA

| Evento | Quando |
| --- | --- |
| `note` | Reflexão qualitativa, texto livre — é o `moment_type` default da tabela |
| `definition` | Redefinição estrutural/textual de uma entidade |

`moment_note` é o texto em linguagem natural anexado a qualquer moment. Ao
usar uma tool de escrita para mudar status, prioridade, due ou estimate, a
IA é instruída a sempre extrair a intenção da conversa e enviá-la como
`reason` — o executor da tool anexa esse texto ao moment que o trigger já
criou, marcado como `authored_by: 'assistant'` (ver
[Integração com IA](03-ai.md#tools-disponíveis)).

---

## Tags

Dois tipos de tags, com propósitos distintos:

**`work_tags`** — descrevem a natureza do trabalho. Extraídas pela IA ao
criar ou descrever projetos, sections e tarefas. Ex: `calligraphy`,
`commission`, `logo`, `watercolor`.

**`moment_tags`** — descrevem o contexto emocional e situacional de um
momento. Extraídas pela IA a partir do `moment_note`. Ex: `productive`,
`tired`, `focused`, `sunny`.

Ambas são normalizadas — cada `*_tags` tem um array `synonyms`, e a IA
aprende a convergir sinônimos ("ensolarado", "sol", "dia bonito") para a
mesma tag ao longo do tempo.

---

## Due vs. Target vs. Schedule

Três conceitos de tempo distintos, fáceis de confundir:

- **`due`** (`timestamptz`) — prazo rígido, definido externamente (cliente,
  contrato). Não é arbitrário.
- **`target`** (`tstzrange`, em `projects`/`sections`/`tasks`) — janela
  planejada e arbitrária para trabalhar no item; deve terminar antes do
  `due` quando ambos existem.
- **`duration`** de um `event` do tipo `scheduled` — o bloco de tempo real
  alocado na agenda para executar a tarefa, vinculado via `task_id`.

O usuário pode "marcar" uma tarefa para um dia específico (toggle na UI, um
moment `today`/`notToday`) antes de qualquer uma dessas três colunas
existir — é uma declaração de intenção, não um agendamento.
