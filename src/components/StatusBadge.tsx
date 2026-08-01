const success = new Set([
  'ACTIVE',
  'APPROVED',
  'PASSED',
  'DEPLOYED',
  'HEALTHY',
  'COMPILED',
  'VALID',
]);
const danger = new Set(['FAILED', 'REJECTED', 'SUSPENDED', 'ERROR', 'CRITICAL', 'INVALID']);
const warning = new Set(['PENDING', 'DRAFT', 'REVIEW', 'RUNNING', 'QUEUED', 'WARNING']);
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

export function StatusBadge({ value }: { value: unknown }) {
  const text = String(value ?? '—').toUpperCase();
  return <span className={`status-badge status-${toneOf(text)}`}>{text}</span>;
}
