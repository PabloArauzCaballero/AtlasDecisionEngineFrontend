import {
  AlertTriangle,
  Check,
  CircleAlert,
  CircleDashed,
  Code2,
  Flag,
  Loader2,
  MinusCircle,
  Network,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import type { ComponentProps } from 'react';
import { nodeTooltip, nodeTypeDefinition } from './node-catalog';
import { runStatusHint, runStatusLabel, type NodeRuntime } from './node-runtime';
import type { NodeBadge } from './node-summary';

/** `type` se reserva para el tipo de nodo, no para el `type` del `<button>`. */
interface GraphNodeCardProps extends Omit<ComponentProps<'button'>, 'type'> {
  /** Nombre visible del nodo. */
  name: string;
  type: string;
  selected?: boolean;
  connectSource?: boolean;
  /** Un nodo terminal no dibuja puerto de salida. */
  terminal?: boolean;
  /**
   * Variables que el paso lee y escribe. Se resumen en la tarjeta y se detallan
   * en el tooltip: es lo que no se podía saber sin abrir el panel lateral.
   */
  io?: { reads: string[]; writes: string[] };
  /** Regla del paso en una línea (`score_buro < 550`). Sólo en modo detallado. */
  summary?: string | null;
  /** Marcas de carácter del nodo: cierra el flujo, lleva código, falta configurar… */
  badges?: NodeBadge[];
  /** Estado de ejecución, cuando el nodo se pinta sobre una traza real. */
  runtime?: NodeRuntime;
}

const BADGES: Record<NodeBadge, { icon: LucideIcon; title: string }> = {
  terminal: { icon: Flag, title: 'Cierra el flujo: después de este paso no continúa.' },
  code: { icon: Code2, title: 'Lleva código JavaScript o Python.' },
  reference: { icon: Network, title: 'Invoca otro algoritmo y usa lo que devuelve.' },
  human: { icon: UserRound, title: 'Necesita que una persona resuelva el caso.' },
  incomplete: { icon: CircleAlert, title: 'Le falta configuración para poder publicarse.' },
};

const RUN_ICONS = {
  pending: CircleDashed,
  running: Loader2,
  done: Check,
  skipped: MinusCircle,
  warning: AlertTriangle,
  error: AlertTriangle,
} as const;

/**
 * Tarjeta de nodo del grafo, compartida por el editor y por la reproducción de
 * ejecuciones.
 *
 * La diferencia entre tipos no descansa en el color: el icono cambia, y con él
 * la forma de su portada (rombo en las bifurcaciones, hexágono en el código,
 * escudo en revisión y error, bandera en el resultado, cápsula en los extremos)
 * y la trama del fondo. La forma se aplica a la portada y no al contorno de la
 * tarjeta porque un rombo recortando el rectángulo entero dejaría el nombre del
 * nodo fuera del área visible.
 *
 * El estado de ejecución añade una cuarta señal, redundante a propósito: icono,
 * texto y color, para que se lea también sin distinguir colores.
 */
export function GraphNodeCard({
  name,
  type,
  selected,
  connectSource,
  terminal,
  io,
  summary,
  badges,
  runtime,
  className,
  ...rest
}: GraphNodeCardProps) {
  const definition = nodeTypeDefinition(type);
  const Icon = definition.icon;
  const RunIcon = runtime ? RUN_ICONS[runtime.status] : null;
  const statusText = runtime ? runStatusLabel(runtime.status) : '';
  const ioText = io
    ? `\nLee: ${io.reads.length ? io.reads.join(', ') : 'nada declarado'}\nEscribe: ${
        io.writes.length ? io.writes.join(', ') : 'nada'
      }`
    : '';
  const ruleText = summary ? `\nRegla: ${summary}` : '';
  const tooltip = runtime
    ? `${nodeTooltip(name, type)}${ruleText}${ioText}\n${statusText}: ${runStatusHint(runtime)}`
    : `${nodeTooltip(name, type)}${ruleText}${ioText}`;

  return (
    <button
      type="button"
      title={tooltip}
      // Siempre el nombre legible del tipo, no su código: un lector de pantalla
      // decía "nodo ACTION" en el editor y "nodo Acción" en la reproducción.
      aria-label={
        runtime
          ? `${name}, nodo ${definition.label}, ${statusText}`
          : `${name}, nodo ${definition.label}`
      }
      className={[
        'graph-node',
        `node-${type.toLowerCase()}`,
        `shape-${definition.shape}`,
        `pattern-${definition.pattern}`,
        runtime ? `run-${runtime.status}` : '',
        selected ? 'selected' : '',
        connectSource ? 'connect-source' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      <span className="graph-node-port graph-node-port-input" aria-hidden="true" />
      <span className="graph-node-icon">
        <Icon size={18} />
      </span>
      <span className="graph-node-copy">
        <strong>{name}</strong>
        <small>{definition.label}</small>
        {/* La regla en la propia tarjeta es lo que evita tener que abrir nodo
            por nodo para saber qué decide cada paso. */}
        {summary ? <em className="graph-node-rule">{summary}</em> : null}
      </span>
      {badges?.length ? (
        <span className="graph-node-badges" aria-hidden="true">
          {badges.map((badge) => {
            const BadgeIcon = BADGES[badge].icon;
            return (
              <i key={badge} className={`badge-${badge}`} title={BADGES[badge].title}>
                <BadgeIcon size={10} />
              </i>
            );
          })}
        </span>
      ) : null}
      {io && (io.reads.length || io.writes.length) ? (
        <span className="graph-node-io" aria-hidden="true">
          <i className="io-reads">↓{io.reads.length}</i>
          <i className="io-writes">↑{io.writes.length}</i>
        </span>
      ) : null}
      {runtime && RunIcon ? (
        <span className={`graph-node-run run-${runtime.status}`}>
          <RunIcon size={12} className={runtime.status === 'running' ? 'spin' : undefined} />
          <span>{statusText}</span>
          {runtime.durationMs !== undefined ? <b>{runtime.durationMs} ms</b> : null}
        </span>
      ) : null}
      {!terminal ? (
        <span className="graph-node-port graph-node-port-output" aria-hidden="true" />
      ) : null}
    </button>
  );
}
