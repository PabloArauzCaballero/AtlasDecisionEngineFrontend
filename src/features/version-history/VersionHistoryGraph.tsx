import Link from 'next/link';
import type { CSSProperties } from 'react';
import { StatusBadge } from '../../components/StatusBadge';
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

const ROW_H = 56;
const LANE_W = 22;
const DOT_R = 6;
const PAD_X = 16;
const LANE_COLORS = ['#006a61', '#2563eb', '#b54708', '#7e22ce', '#067647', '#c81e1e'];

const laneX = (lane: number) => PAD_X + lane * LANE_W;
const rowY = (row: number) => row * ROW_H + ROW_H / 2;
const laneColor = (lane: number) => LANE_COLORS[lane % LANE_COLORS.length];

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
            d={edgePath(edge.fromLane, edge.fromRow, edge.toLane, edge.toRow)}
            fill="none"
            stroke={laneColor(Math.min(edge.fromLane, edge.toLane))}
            strokeWidth={2}
          />
        ))}
        {nodes.map((node) => (
          <circle
            key={node.id}
            cx={laneX(node.lane)}
            cy={rowY(node.row)}
            r={DOT_R}
            fill={laneColor(node.lane)}
            stroke="#ffffff"
            strokeWidth={2}
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
              <span className="version-graph-actions">
                <Link href={`/artifact-versions/${version.id}/graph`}>Grafo</Link>
                <Link href={`/artifact-versions/${version.id}/compile`}>Compilar</Link>
                <Link href={`/artifact-versions/${version.id}/test-suites`}>Pruebas</Link>
              </span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function edgePath(fromLane: number, fromRow: number, toLane: number, toRow: number): string {
  const cx = laneX(fromLane);
  const cy = rowY(fromRow);
  const px = laneX(toLane);
  const py = rowY(toRow);
  if (fromLane === toLane) return `M ${cx} ${cy} L ${px} ${py}`;
  // Curva en S: baja desde el hijo y se mete en el carril del padre.
  return `M ${cx} ${cy} C ${cx} ${cy + ROW_H * 0.55}, ${px} ${py - ROW_H * 0.55}, ${px} ${py}`;
}

function formatDate(value: string): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('es', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
