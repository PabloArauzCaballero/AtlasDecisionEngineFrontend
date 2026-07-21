const TONE: Record<string, string> = {
  HIGH: 'severity-high',
  MEDIUM: 'severity-medium',
  LOW: 'severity-low',
};

interface SeverityBadgeProps {
  value: unknown;
}

/** Fase 10 — security review severity (LOW/MEDIUM/HIGH). */
export function SeverityBadge({ value }: SeverityBadgeProps) {
  const label = String(value ?? 'LOW');
  return <span className={`severity-badge ${TONE[label] ?? 'severity-low'}`}>{label}</span>;
}
