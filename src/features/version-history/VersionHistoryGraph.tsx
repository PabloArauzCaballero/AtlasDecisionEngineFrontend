import type { CSSProperties } from 'react';
import { ActionIcon } from '../../components/ActionIcon';
import { StatusBadge } from '../../components/StatusBadge';
import { formatDateTime } from '../../config/locale';
import { ZoomableFlow } from '../graph-view/ZoomableFlow';
import { layoutVersionGraph } from './version-graph-layout';

export interface VersionRow {
  id: string;
  parentId: string | null;
  label: string;
  status: unknown;
  createdAt: string;
  createdBy: string;
  changeSummary: string;
}

/*
 * Alto de fila y altura del punto en el riel.
 *
 * El riel es un SVG hermano de la lista: dibuja cada commit en
 * `fila × ROW_H + DOT_Y`, así que ambos números tienen que describir la fila
 * REAL o el grafo deja de señalar lo que dice señalar. Medido en el navegador,
 * una fila ocupa 83 px (título 19 + resumen 17 + pie 32 + huecos 6 + relleno 8
 * + línea 1) y su punto de carril cae a 14 px del borde superior.
 *
 * Estaban en 56 px, y como la fila es flex de alto fijo, los 27 px que faltaban
 * salieron de donde podían salir: el resumen del cambio lleva `overflow:hidden`
 * para los puntos suspensivos, y eso APAGA su tamaño mínimo automático, así que
 * fue el único hijo que se pudo encoger. Se quedó en altura 0 —el mensaje de
 * cada commit, invisible— y el resto de la fila desalineado del riel.
 */
const ROW_H = 84;
const DOT_Y = 14;
const LANE_W = 26;
const DOT_R = 8;
const PAD_X = 18;
/** Radio del codo con el que una rama entra en el carril de su origen. */
const ELBOW_R = 11;
/** Cuántos carriles distingue la paleta antes de repetirse. */
const LANE_COUNT = 6;

const laneX = (lane: number) => PAD_X + lane * LANE_W;
const rowY = (row: number) => row * ROW_H + DOT_Y;
/**
 * Color del carril, por token.
 *
 * Eran seis hexadecimales escritos en este archivo, y el punto se perfilaba en
 * `#ffffff`: en tema oscuro el perfil quedaba como un halo blanco y los tonos,
 * calculados para fondo claro, se apagaban contra el fondo. Los tokens tienen
 * una versión por tema (`theme.css`).
 */
const laneColor = (lane: number) => `var(--lane-${(lane % LANE_COUNT) + 1})`;

/**
 * Historial de versiones dibujado como un grafo de git: cada versión es un
 * commit, la arista baja hacia su versión de origen (`sourceVersionId`) y las
 * ramas ocupan carriles de color. Se alimenta del mismo `get` del artefacto.
 */
export function VersionHistoryGraph({ versions }: { versions: VersionRow[] }) {
  if (!versions.length) {
    return <p className="empty-state">Este artefacto todavía no tiene versiones.</p>;
  }

  const { nodes, edges, laneCount } = layoutVersionGraph(
    versions.map((version) => ({ id: version.id, parentId: version.parentId })),
  );
  const laneById = new Map(nodes.map((node) => [node.id, node.lane]));
  const svgWidth = PAD_X * 2 + Math.max(0, laneCount - 1) * LANE_W;
  const svgHeight = versions.length * ROW_H;

  return (
    // Un artefacto veterano acumula decenas de versiones y varias ramas abiertas: alejar
    // es la única forma de ver la forma del historial —dónde se bifurcó y dónde volvió a
    // juntarse— sin recorrerlo fila a fila.
    <ZoomableFlow label="Escala del historial de versiones" className="version-graph-zoom">
      <div className="version-graph">
        <svg
          className="version-graph-rails"
          width={svgWidth}
          height={svgHeight}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          aria-hidden
        >
          {edges.map((edge) => (
            <path
              key={`${edge.from}-${edge.to}`}
              className="version-graph-edge"
              d={edgePath(edge.fromLane, edge.fromRow, edge.toLane, edge.toRow)}
              stroke={laneColor(Math.min(edge.fromLane, edge.toLane))}
            />
          ))}
          {nodes.map((node) => (
            /*
             * La versión más reciente se dibuja como anillo y el resto macizas:
             * es la cabecera del historial, y en un visor de git es lo primero que
             * se busca. Con todas iguales había que leer las fechas para saber
             * cuál era.
             */
            <circle
              key={node.id}
              className={node.row === 0 ? 'version-graph-node is-head' : 'version-graph-node'}
              cx={laneX(node.lane)}
              cy={rowY(node.row)}
              r={DOT_R}
              fill={node.row === 0 ? 'transparent' : laneColor(node.lane)}
              stroke={laneColor(node.lane)}
            />
          ))}
        </svg>
        <ol className="version-graph-rows" style={{ '--row-h': `${ROW_H}px` } as CSSProperties}>
          {versions.map((version) => (
            <li className="version-graph-row" key={version.id}>
              <div className="version-graph-heading">
                <span
                  className="version-graph-dot"
                  style={{ background: laneColor(laneById.get(version.id) ?? 0) }}
                />
                <strong className="mono">v{version.label}</strong>
                <StatusBadge value={version.status} />
              </div>
              <p className="version-graph-summary">
                {version.changeSummary || 'Sin resumen de cambios.'}
              </p>
              <div className="version-graph-meta">
                <span>{formatDate(version.createdAt)}</span>
                <span>· {version.createdBy || '—'}</span>
                <span className="version-graph-actions action-row">
                  <ActionIcon
                    action="graph"
                    href={`/artifact-versions/${version.id}/graph`}
                    label={`Ver grafo de v${version.label}`}
                  />
                  <ActionIcon
                    action="compile"
                    href={`/artifact-versions/${version.id}/compile`}
                    label={`Compilar v${version.label}`}
                  />
                  <ActionIcon
                    action="tests"
                    href={`/artifact-versions/${version.id}/test-suites`}
                    label={`Ver pruebas de v${version.label}`}
                  />
                </span>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </ZoomableFlow>
  );
}

/**
 * Trazo de una rama hacia su versión de origen.
 *
 * Codo con esquina redondeada, no curva en S: es el trazo de cualquier visor de
 * git y no es una preferencia estética. La S cruza el espacio en diagonal, así
 * que con tres ramas abiertas es imposible saber a qué carril pertenece cada
 * hebra a media altura; el codo mantiene la hebra DENTRO de su carril todo el
 * recorrido y sólo lo cambia en un punto concreto, que es el momento en que la
 * rama nació.
 *
 * El tramo horizontal va a la altura del padre: así la rama «entra» en él, en
 * lugar de salir de él, que es la dirección en la que se lee un historial.
 */
function edgePath(fromLane: number, fromRow: number, toLane: number, toRow: number): string {
  const cx = laneX(fromLane);
  const cy = rowY(fromRow);
  const px = laneX(toLane);
  const py = rowY(toRow);
  if (fromLane === toLane) return `M ${cx} ${cy} L ${px} ${py}`;

  const sweep = px < cx ? 1 : 0;
  const corner = px < cx ? cx - ELBOW_R : cx + ELBOW_R;
  // Baja por su carril hasta un radio del padre, gira, y entra recto.
  return [
    `M ${cx} ${cy}`,
    `L ${cx} ${py - ELBOW_R}`,
    `A ${ELBOW_R} ${ELBOW_R} 0 0 ${sweep} ${corner} ${py}`,
    `L ${px} ${py}`,
  ].join(' ');
}

/** Igual que el resto del portal: el formato vive en `config/locale`. */
function formatDate(value: string): string {
  const formatted = formatDateTime(value);
  return formatted === '—' && value ? value : formatted;
}
