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

export function StatusBadge({ value }: { value: unknown }) {
  const text = String(value ?? '—').toUpperCase();
  const tone = success.has(text)
    ? 'success'
    : danger.has(text)
      ? 'danger'
      : warning.has(text)
        ? 'warning'
        : 'neutral';
  return <span className={`status-badge status-${tone}`}>{text}</span>;
}
