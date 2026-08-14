// Trilho estilo git-graph à esquerda das tarefas de uma seção: um nó por
// tarefa encadeada, linhas verticais ligando a cadeia, curvas de bifurcação
// (uma tarefa com vários "next") e de junção (vários "previous"). O layout
// (lanes/cores/curvas) vem de buildSequenceRail; cada linha da lista desenha
// só a sua fatia do trilho, então alturas variáveis de TaskRow não precisam
// ser medidas.
import type { RailBend, RailRow } from '../../lib/sequenceGraph';

// 10 -> 14 (separação de fork ficar óbvia) -> 11 (o bug real era as cores
// undefined tornando lanes invisíveis, não a distância -- resolvido isso,
// coube encolher de volta a distância entre linhas).
export const LANE_WIDTH = 11;
// Centro vertical da primeira linha de texto do TaskRow (py-1.5 + text-sm).
const NODE_Y = 16;
// Altura da curva de bifurcação logo abaixo do nó — NODE_Y + BEND_H não
// pode passar da altura mínima de uma row (32px). Levada ao teto desse
// orçamento (era 14) para abrir o mais possível antes de precisar ficar reta.
const BEND_H = 16;
// space-y-0.5 entre as linhas — os segmentos vazam 2px para cima/baixo para
// a linha ficar contínua através do vão.
const ROW_GAP = 2;

const LANE_COLORS = [
  'var(--color-pontus-400)',
  'var(--color-eros-400)',
  'var(--color-hypnos-400)',
  'var(--color-gaia-500)',
  'var(--color-tartarus-500)',
];

const laneColor = (colorIndex: number) =>
  LANE_COLORS[colorIndex % LANE_COLORS.length];
const laneCenter = (lane: number) => lane * LANE_WIDTH + LANE_WIDTH / 2;

// Curva entre duas lanes dentro de uma faixa horizontal de altura fixa.
function Bend({
  bend,
  top,
  height,
  width,
}: {
  bend: RailBend;
  top: number;
  height: number;
  width: number;
}) {
  // merge: desce de fromLane (topo da faixa) até toLane (base = nó);
  // fork: sai de fromLane (topo = nó) e abre para toLane (base).
  const x1 = laneCenter(bend.fromLane);
  const x2 = laneCenter(bend.toLane);
  const mid = height / 2;
  return (
    <svg
      className="absolute"
      style={{ left: 0, top }}
      width={width}
      height={height}
      aria-hidden
    >
      <path
        d={`M ${x1} 0 C ${x1} ${mid + 2}, ${x2} ${mid - 2}, ${x2} ${height}`}
        fill="none"
        stroke={laneColor(bend.colorIndex)}
        strokeWidth={2}
      />
    </svg>
  );
}

// Enquanto tasks_sequence ainda está carregando, o rail real não pode ser
// calculado (laneCount depende dos dados) — sem isto, essa janela de
// loading é indistinguível de "esta seção não tem sequência", que também
// não renderiza nada. Um traço tracejado "andando" no lugar exato onde o
// rail real vai aparecer comunica "carregando", não "vazio". Nós vazados
// (sem preenchimento, já que ainda não sabemos se ali vai ter um nó de
// verdade) marcam o início e o fim da lista, pra não ler como um traço
// solto sem começo/fim.
export function SequenceRailLoading({
  isFirst = false,
  isLast = false,
}: {
  isFirst?: boolean;
  isLast?: boolean;
}) {
  const cx = laneCenter(0);
  return (
    <div className="relative shrink-0" style={{ width: LANE_WIDTH }} aria-hidden>
      <div
        className="sequence-rail-loading absolute w-0.5"
        style={{ left: cx - 1, top: -ROW_GAP, bottom: -ROW_GAP }}
      />
      {isFirst && (
        <div
          className="border-nyx-500 bg-nyx-900 absolute size-[7px] rounded-full border"
          style={{ left: cx - 3.5, top: NODE_Y - 3.5 }}
        />
      )}
      {isLast && (
        <div
          className="border-nyx-500 bg-nyx-900 absolute size-[7px] rounded-full border"
          style={{ left: cx - 3.5, top: NODE_Y - 3.5 }}
        />
      )}
    </div>
  );
}

// Se a query de tasks_sequence falhar, o rail também ficaria "vazio" sem
// nenhum indício de que os dados de sequência não puderam ser lidos — daí
// o X, para diferenciar de "esta seção nunca teve sequência". É uma falha
// só (query única, compartilhada por toda a seção), então o marcador
// aparece apenas na primeira linha -- repeti-lo em cada tarefa daria a
// entender que cada uma falhou individualmente.
export function SequenceRailError({ isFirst = false }: { isFirst?: boolean }) {
  return (
    <div
      className="relative flex shrink-0 items-center justify-center"
      style={{ width: LANE_WIDTH }}
      title={isFirst ? 'Failed to load task sequence' : undefined}
    >
      {isFirst && (
        <span className="text-tartarus-500 text-[10px] leading-none">×</span>
      )}
    </div>
  );
}

interface SequenceRailCellProps {
  row: RailRow;
  laneCount: number;
}

export default function SequenceRailCell({
  row,
  laneCount,
}: SequenceRailCellProps) {
  const width = laneCount * LANE_WIDTH;
  return (
    <div className="relative shrink-0" style={{ width }} aria-hidden>
      {row.lines.map((s) => {
        const color = laneColor(s.colorIndex);
        const cx = laneCenter(s.lane);
        // Nó de bifurcação/junção: a curva sozinha pode não deixar óbvio
        // que a tarefa tem mais de uma anterior/seguinte -- o tooltip
        // torna isso explícito ao passar o mouse ou tocar no ponto.
        const forkCount = s.node ? row.forks.length : 0;
        const mergeCount = s.node ? row.merges.length : 0;
        const nodeTitle = forkCount
          ? `Ramifica em ${forkCount + 1} tarefas seguintes`
          : mergeCount
            ? `Junta ${mergeCount + 1} tarefas anteriores`
            : undefined;
        return (
          <div key={s.lane}>
            {s.drawTop && (
              <div
                className="absolute w-0.5"
                style={{
                  left: cx - 1,
                  top: -ROW_GAP,
                  height: NODE_Y + ROW_GAP,
                  backgroundColor: color,
                }}
              />
            )}
            {s.drawBottom && (
              <div
                className="absolute w-0.5"
                style={{
                  left: cx - 1,
                  top: NODE_Y,
                  bottom: -ROW_GAP,
                  backgroundColor: color,
                }}
              />
            )}
            {s.node && (
              <div
                className="absolute size-[7px] rounded-full"
                style={{
                  left: cx - 3.5,
                  top: NODE_Y - 3.5,
                  backgroundColor: color,
                }}
                title={nodeTitle}
              />
            )}
          </div>
        );
      })}

      {row.merges.map((m) => (
        <Bend
          key={`m${m.fromLane}`}
          bend={m}
          top={0}
          height={NODE_Y}
          width={width}
        />
      ))}

      {row.forks.map((f) => (
        <div key={`f${f.toLane}`}>
          <Bend bend={f} top={NODE_Y} height={BEND_H} width={width} />
          {/* continuação vertical da lane nova até a base da row */}
          <div
            className="absolute w-0.5"
            style={{
              left: laneCenter(f.toLane) - 1,
              top: NODE_Y + BEND_H,
              bottom: -ROW_GAP,
              backgroundColor: laneColor(f.colorIndex),
            }}
          />
        </div>
      ))}
    </div>
  );
}
