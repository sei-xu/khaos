# Khaos — Camada de dados

Não existe uma API REST própria (a antiga API FastAPI descrita nas versões
anteriores desta documentação foi descontinuada). O frontend fala
diretamente com o Postgres via `@supabase/supabase-js`
(`src/lib/supabaseClient.ts`), e cada tabela tem um módulo dedicado em
`src/lib/api/`.

Cada módulo segue o mesmo padrão: funções assíncronas que chamam
`supabase.from('<tabela>')`, com um `unwrap()` local que lança o erro do
Supabase ou retorna os dados tipados.

## `hierarchy.ts` — fields, projects, sections, tasks, task_items

| Export | Operações |
| --- | --- |
| `fieldsApi` | `list`, `create`, `update`, `remove` |
| `projectsApi` | `list` (exclui deletados e `done`/`cancelled`), `get`, `create`, `update`, `remove` (soft delete via `deleted_at`) |
| `sectionsApi` | `list`, `listByProject`, `create`, `update`, `remove`, `persistOrder` (reescreve `sections_sequence` a partir de uma lista ordenada) |
| `sectionsSequenceApi` | `list` |
| `tasksApi` | `list`, `listBySection`, `create`, `update`, `remove` |
| `tasksSequenceApi` | `list` |
| `taskItemsApi` | `listByTask`, `create`, `update`, `remove` (hard delete) |

`tasksApi` não tem `persistOrder` por linked-list: essa ordenação manual de
tasks dentro de uma seção foi removida de propósito — a ordem visual de uma
seção é calculada no client, cronologicamente, a partir de `schedule`/`due`
(ver `ProjectDetailPage`). `tasks_sequence` continua existindo, mas só
representa dependência real ("esta tarefa só faz sentido depois daquela"),
não posição de exibição.

Ordem manual de tasks voltou, mas por um caminho diferente: um rank
numérico (`tasks.backlog_rank`), não uma linked-list — ver `backlog.ts`
abaixo.

## `sequence.ts` — dependência entre tasks

`sequenceApi.add(previousId, nextId)` / `remove(previousId, nextId)` — insere
ou remove uma aresta em `tasks_sequence`. Ver
[Banco de dados](01-database.md#tasks_sequence--sections_sequence) para o
efeito colateral de status (`waiting` → `todo`) que os triggers do banco
aplicam a partir dessas arestas.

## `backlog.ts` — fila global de ordem (`tasks.backlog_rank`)

| Export | Operações |
| --- | --- |
| `backlogApi` | `add` (acrescenta ao fim, rank = máximo atual + `RANK_STEP`), `move(taskId, rank)` (grava um rank já calculado), `removeFromBacklog` (seta `backlog_rank = NULL`), `rebalance(updates)` (reescreve ranks em lote), `listOrdered` |

A aritmética pura (não depende de React nem do Supabase) vive em
`src/lib/backlogRank.ts`: `RANK_STEP`, `orderByRank`, `rankBetween`,
`rankForIndex`, `needsRebalance`, `rebalanceRanks`. Mover uma task escreve
uma única linha (o novo rank é o ponto médio entre os vizinhos); quando o
gap entre vizinhos colapsa, `rebalanceRanks` reatribui ranks igualmente
espaçados para a lista inteira.

Diferente de `sections_sequence`/a antiga ordenação de tasks, isto não é uma
linked-list — é um rank numérico esparso, escolhido deliberadamente para
não reabrir o `persistOrder` de `tasks_sequence` que foi removido (ver
acima). O hook `useBacklogMutations` (em `src/hooks/useBacklog.ts`) expõe
`reorder` (índice-baseado, com rebalanceamento — usa a fila inteira) e
`move` (grava um rank já calculado, sem rebalancear — para quando o chamador
só vê uma vizinhança parcial, como o grupo Marked do Today).

## `events.ts`

`eventsApi.list/create/update/remove`. `create`/`update` recebem um shape de
alto nível (`EventInput`: `name`, `eventType`, `recurrent`, `start`, `end`,
`taskId`, `projectId`, `fieldId`) e traduzem para o formato de coluna do
banco, incluindo montar o `tstzrange` de `duration` via `formatRange()`.
`remove` é soft delete (`deleted_at`).

## `timeTracking.ts` — task_logs

| Função | Efeito |
| --- | --- |
| `start(taskId?, note?, projectId?, background?)` | Insere um `task_log` aberto |
| `stop()` | RPC `stop_active_task` — encerra o log foreground aberto |
| `stopLog(id)` | RPC `stop_task_log` — encerra um log específico (foreground ou background) |
| `getActive()` | RPC `get_active_task_log` — todos os logs abertos no momento |
| `listByTask(taskId)` | Histórico de logs de uma tarefa |
| `listAll({ since })` | Todos os logs, com o `task` relacionado embutido (`*, tasks(id, name, section_id)`) |
| `update(id, patch)` / `remove(id)` | Edição/remoção direta de um log |

## `routines.ts`

`routinesApi.list` (com `fields(name)` embutido), `create`, `update`,
`remove`, e `listWithEvents(weekStart, weekEnd)` que busca em paralelo os
routines ativos e os `events` do tipo `routine` na janela da semana. Até
2026-10-25 essa última função não tinha nenhum chamador — nada no
repositório gerava `event_type='routine'`, então a query sempre voltava
vazia (ver `docs/05-roadmap.md` e `docs/backlog.md`, "Rotinas devem ser
criadas por cron/assistente..."). Agora que `supabase/functions/
routine-events` e a tool `materialize_routines` materializam ocorrências de
verdade, a função passa a ter dados reais para retornar; continua sem
chamador na UI (CalendarPage lê via `eventsApi.list()`, que não filtra por
`event_type`, então ocorrências de rotina já aparecem lá sem passar por
`listWithEvents`) — mantida por ser uma consulta útil para uma futura
visão de semana dedicada a rotinas, não removida como código morto.

## `moments.ts`

Leitura/escrita da tabela `moments` usada pela UI (a maior parte dos moments
é, na prática, gerada automaticamente pelos triggers do banco — ver
[Banco de dados](01-database.md#moments)).

## `tags.ts` — work_tags

`tagsApi.list`, `create(name)`, `remove(id)`, `listLinks` (todas as
associações), `listForEntity(entityRef)` (tags de uma entidade específica,
com o `work_tag` embutido), `attach(tagId, entityRef)`,
`detach(tagId, entityRef)`. `entityRef` é um mapa `{ coluna: id }` (ex:
`{ task_id: '...' }`) aplicado como filtro `eq` extra.

Não há um módulo equivalente dedicado a `moment_tags` hoje — a UI não expõe
edição direta desse lado; a IA cria/associa `moment_tags` via suas próprias
tools genéricas (ver [Integração com IA](03-ai.md)).

## Hooks que consomem esses módulos

`src/hooks/` expõe um hook por domínio (`useHierarchy`, `useEvents`,
`useSequence`, `useTags`, `useTimeTracking`, `useRoutines`, `useMoments`,
`useChatAgent`) que envolve o módulo de `api/` correspondente com
`@tanstack/react-query` (cache, invalidação, estados de loading/erro) para
consumo pelas páginas em `src/pages/`.
