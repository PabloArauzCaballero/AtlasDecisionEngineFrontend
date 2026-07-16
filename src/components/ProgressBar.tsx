export function ProgressBar({
  value,
  tone = 'success',
}: {
  value: number;
  tone?: 'success' | 'warning' | 'danger' | 'info';
}) {
  const bounded = Math.max(0, Math.min(100, value));
  return (
    <div className={`progress progress-${tone}`} aria-label={`${bounded}%`}>
      <span style={{ width: `${bounded}%` }} />
    </div>
  );
}
