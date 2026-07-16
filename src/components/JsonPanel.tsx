interface JsonPanelProps {
  value: unknown;
  label?: string;
}

export function JsonPanel({ value, label = 'Respuesta' }: JsonPanelProps) {
  return (
    <section className="json-panel" aria-label={label}>
      <div className="panel-title">
        <span>{label}</span>
        <small>JSON</small>
      </div>
      <pre>{JSON.stringify(value, null, 2)}</pre>
    </section>
  );
}
