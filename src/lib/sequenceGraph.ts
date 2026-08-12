// Helpers puros sobre o grafo de sequência (tasks_sequence).
// Uma aresta {task_previous, task_next} significa: task_next vem depois de
// task_previous.

import type { Id, TasksSequence } from './types';

// Adicionar previousId -> nextId criaria um ciclo se nextId já conseguir
// alcançar previousId percorrendo as arestas existentes.
export function wouldCreateCycle(
  edges: TasksSequence[],
  previousId: Id,
  nextId: Id
): boolean {
  const adjacency = new Map<Id, Id[]>();
  edges.forEach(({ task_previous, task_next }) => {
    if (!adjacency.has(task_previous)) adjacency.set(task_previous, []);
    adjacency.get(task_previous)!.push(task_next);
  });

  const visited = new Set<Id>();
  const stack = [nextId];
  while (stack.length) {
    const current = stack.pop()!;
    if (current === previousId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    (adjacency.get(current) || []).forEach((next) => stack.push(next));
  }
  return false;
}

// Ordenação de uma lista de tarefas respeitando primeiro a sequência
// (ordem topológica das arestas internas à lista) e, entre tarefas
// disponíveis ao mesmo tempo, o critério cronológico `key`. Em empate de
// key, a tarefa liberada mais recentemente vence — isso mantém uma cadeia
// contígua quando as datas não dizem o contrário. Ciclos não deveriam
// existir (bloqueados na criação); se houver, os envolvidos vão para o fim.
export function topoChronoOrder<T extends { id: Id }>(
  items: T[],
  edges: TasksSequence[],
  key: (item: T) => number
): T[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const indegree = new Map<Id, number>();
  const outgoing = new Map<Id, Id[]>();
  edges.forEach((e) => {
    if (!byId.has(e.task_previous) || !byId.has(e.task_next)) return;
    indegree.set(e.task_next, (indegree.get(e.task_next) ?? 0) + 1);
    const list = outgoing.get(e.task_previous) ?? [];
    list.push(e.task_next);
    outgoing.set(e.task_previous, list);
  });

  const baseIndex = new Map(items.map((item, i) => [item.id, i]));
  const enabledAt = new Map<Id, number>();
  const available = items.filter((item) => !(indegree.get(item.id) ?? 0));
  available.forEach((item) => enabledAt.set(item.id, 0));

  const result: T[] = [];
  let tick = 0;
  while (available.length) {
    let best = 0;
    for (let i = 1; i < available.length; i++) {
      const a = available[i];
      const b = available[best];
      const ka = key(a);
      const kb = key(b);
      if (
        ka < kb ||
        (ka === kb &&
          (enabledAt.get(a.id)! > enabledAt.get(b.id)! ||
            (enabledAt.get(a.id) === enabledAt.get(b.id) &&
              baseIndex.get(a.id)! < baseIndex.get(b.id)!)))
      ) {
        best = i;
      }
    }
    const item = available.splice(best, 1)[0];
    result.push(item);
    tick += 1;
    (outgoing.get(item.id) ?? []).forEach((nextId) => {
      const d = (indegree.get(nextId) ?? 0) - 1;
      indegree.set(nextId, d);
      if (d === 0) {
        available.push(byId.get(nextId)!);
        enabledAt.set(nextId, tick);
      }
    });
  }

  if (result.length < items.length) {
    const seen = new Set(result.map((r) => r.id));
    items.forEach((item) => {
      if (!seen.has(item.id)) result.push(item);
    });
  }
  return result;
}

// Uma linha vertical na lane, sempre relativa ao nível do nó da row:
// drawTop desenha do topo até o nó, drawBottom do nó até a base.
export interface RailLine {
  lane: number;
  colorIndex: number;
  node: boolean;
  drawTop: boolean;
  drawBottom: boolean;
}

// Curva ligando duas lanes: merge chega ao nó vindo de cima (fromLane some),
// fork sai do nó para baixo abrindo uma lane nova (toLane nasce).
export interface RailBend {
  fromLane: number;
  toLane: number;
  colorIndex: number;
}

export interface RailRow {
  lines: RailLine[];
  merges: RailBend[];
  forks: RailBend[];
}

export interface RailLayout {
  laneCount: number;
  // Alinhado com orderedIds: rows[i] é o desenho do trilho na linha i.
  rows: RailRow[];
}

// Tarefas done/cancelled somem de visibleTasks (fade de seções infinitas,
// ver infiniteFade.ts) sem que suas arestas em tasks_sequence sejam
// removidas. Sem isso, uma cadeia A -> B -> C perde o traço inteiro quando
// B desaparece: a aresta A->B e a B->C ficam com uma ponta fora da lista
// visível e são descartadas por buildSequenceRail. Aqui a cadeia é
// recalculada pulando os ids ocultos, para o trilho continuar ligando A a C
// diretamente.
export function collapseHiddenEdges(
  edges: TasksSequence[],
  hiddenIds: Set<Id>
): TasksSequence[] {
  if (hiddenIds.size === 0) return edges;

  const outgoing = new Map<Id, Id[]>();
  edges.forEach((e) => {
    const list = outgoing.get(e.task_previous) ?? [];
    list.push(e.task_next);
    outgoing.set(e.task_previous, list);
  });

  const memo = new Map<Id, Id[]>();
  const resolveVisible = (id: Id, seen: Set<Id>): Id[] => {
    if (memo.has(id)) return memo.get(id)!;
    if (seen.has(id)) return []; // guarda contra ciclo residual
    seen.add(id);
    const result: Id[] = [];
    (outgoing.get(id) ?? []).forEach((next) => {
      const targets = hiddenIds.has(next) ? resolveVisible(next, seen) : [next];
      targets.forEach((t) => {
        if (!result.includes(t)) result.push(t);
      });
    });
    memo.set(id, result);
    return result;
  };

  const result: TasksSequence[] = [];
  outgoing.forEach((_, prev) => {
    if (hiddenIds.has(prev)) return;
    resolveVisible(prev, new Set()).forEach((next) =>
      result.push({ task_previous: prev, task_next: next })
    );
  });
  return result;
}

// Layout git-graph para uma lista já em ordem topológica (topoChronoOrder):
// cada lane "espera" a próxima tarefa da cadeia; uma tarefa que é previous
// de várias bifurca (fork) em lanes novas, e uma tarefa com vários previous
// junta as lanes (merge). Arestas com uma ponta fora da lista — ou
// "subindo", caso a ordem não seja topológica — são ignoradas; os
// contadores before/after do TaskRow seguem cobrindo essas ligações.
export function buildSequenceRail(
  orderedIds: Id[],
  edges: TasksSequence[]
): RailLayout {
  const indexById = new Map<Id, number>(orderedIds.map((id, i) => [id, i]));
  const outgoing = new Map<Id, Id[]>();
  edges.forEach((e) => {
    const from = indexById.get(e.task_previous);
    const to = indexById.get(e.task_next);
    if (from === undefined || to === undefined || to <= from) return;
    const list = outgoing.get(e.task_previous) ?? [];
    if (!list.includes(e.task_next)) list.push(e.task_next);
    outgoing.set(e.task_previous, list);
  });

  const rows: RailRow[] = [];
  // lanes[i] = a lane i está aberta esperando conectar em `target`.
  const lanes: ({ target: Id; colorIndex: number } | null)[] = [];
  let colorCounter = 0;
  let laneCount = 0;

  const allocLane = () => {
    let lane = lanes.findIndex((l) => l === null);
    if (lane === -1) {
      lane = lanes.length;
      lanes.push(null);
    }
    laneCount = Math.max(laneCount, lane + 1);
    return lane;
  };

  orderedIds.forEach((id) => {
    const row: RailRow = { lines: [], merges: [], forks: [] };
    const incoming: number[] = [];
    lanes.forEach((lane, i) => {
      if (lane?.target === id) incoming.push(i);
    });
    const successors = (outgoing.get(id) ?? [])
      .slice()
      .sort((a, b) => indexById.get(a)! - indexById.get(b)!);

    // Lanes alheias a esta tarefa passam direto.
    lanes.forEach((lane, i) => {
      if (!lane || lane.target === id) return;
      row.lines.push({
        lane: i,
        colorIndex: lane.colorIndex,
        node: false,
        drawTop: true,
        drawBottom: true,
      });
    });

    if (incoming.length || successors.length) {
      const nodeLane = incoming.length ? incoming[0] : allocLane();
      const nodeColor = incoming.length
        ? lanes[nodeLane]!.colorIndex
        : colorCounter++;

      incoming.slice(1).forEach((lane) => {
        row.merges.push({
          fromLane: lane,
          toLane: nodeLane,
          colorIndex: lanes[lane]!.colorIndex,
        });
        lanes[lane] = null;
      });

      // O nó continua na própria lane até o primeiro sucessor; os demais
      // sucessores bifurcam em lanes novas, cada uma com cor própria.
      const [first, ...branches] = successors;
      row.lines.push({
        lane: nodeLane,
        colorIndex: nodeColor,
        node: true,
        drawTop: incoming.length > 0,
        drawBottom: Boolean(first),
      });
      lanes[nodeLane] = first ? { target: first, colorIndex: nodeColor } : null;
      branches.forEach((target) => {
        const lane = allocLane();
        const colorIndex = colorCounter++;
        lanes[lane] = { target, colorIndex };
        row.forks.push({ fromLane: nodeLane, toLane: lane, colorIndex });
      });
    }

    rows.push(row);
  });

  return { laneCount, rows };
}
