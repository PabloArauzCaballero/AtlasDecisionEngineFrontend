const success = new Set([
  'ACTIVE',
  'APPROVED',
  'PASSED',
  'DEPLOYED',
  'HEALTHY',
  'COMPILED',
  'VALID',
  // Cobertura: un cruce con artefacto Y prueba. Sin esto los tres estados de la
  // matriz caían en `neutral` y COMPLETO se veía igual que HUECO.
  'COMPLETE',
]);
const danger = new Set(['FAILED', 'REJECTED', 'SUSPENDED', 'ERROR', 'CRITICAL', 'INVALID']);
const warning = new Set(['PENDING', 'DRAFT', 'REVIEW', 'RUNNING', 'QUEUED', 'WARNING', 'PARTIAL']);
// Sentido de una variable: se pinta con los mismos colores que los distintivos
// entrada/salida del editor, para que la diferencia se vea igual en todo el portal.
const inbound = new Set(['ENTRADA', 'INPUT']);
const outbound = new Set(['SALIDA', 'OUTPUT', 'OUTPUT_PRIMARY']);

function toneOf(text: string): string {
  if (success.has(text)) return 'success';
  if (danger.has(text)) return 'danger';
  if (warning.has(text)) return 'warning';
  if (inbound.has(text)) return 'in';
  if (outbound.has(text)) return 'out';
  if (text === 'ENTRADA Y SALIDA') return 'inout';
  return 'neutral';
}

interface Props {
  value: unknown;
  /**
   * Etiquetas legibles por valor crudo del backend (p. ej. `SENSITIVITY_LABELS`).
   * Un valor sin entrada en el mapa se muestra tal cual: no es un error, solo
   * algo que este catálogo todavía no traduce.
   */
  labels?: Record<string, string>;
}

export function StatusBadge({ value, labels }: Props) {
  const text = String(value ?? '—').toUpperCase();
  const label = labels?.[text] ?? text;
  return <span className={`status-badge status-${toneOf(text)}`}>{label}</span>;
}
