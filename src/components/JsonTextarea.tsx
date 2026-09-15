import { Field } from './Field';

interface JsonTextareaProps {
  id: string;
  label: string;
  /** Qué poner en el área y con qué forma. */
  tooltip: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}

export function JsonTextarea({
  id,
  label,
  tooltip,
  value,
  onChange,
  rows = 14,
}: JsonTextareaProps) {
  return (
    <Field label={label} tooltip={tooltip}>
      <textarea
        id={id}
        className="code-input"
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
      />
    </Field>
  );
}
