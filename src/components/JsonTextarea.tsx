interface JsonTextareaProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}

export function JsonTextarea({ id, label, value, onChange, rows = 14 }: JsonTextareaProps) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea
        id={id}
        className="code-input"
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
      />
    </label>
  );
}
