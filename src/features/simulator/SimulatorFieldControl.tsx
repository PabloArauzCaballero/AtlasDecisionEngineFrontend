'use client';

const NUMERIC = new Set(['NUMBER', 'INTEGER', 'INT', 'DECIMAL', 'FLOAT']);
const STRUCTURED = new Set(['OBJECT', 'JSON', 'ARRAY', 'LIST']);

interface Props {
  dataType: string;
  value: unknown;
  onCommit: (next: unknown) => void;
}

/** Control de edición adecuado al tipo declarado de una variable de entrada. */
export function FieldControl({ dataType, value, onCommit }: Props) {
  if (NUMERIC.has(dataType)) {
    return (
      <input
        type="number"
        value={value === undefined || value === null ? '' : String(value)}
        onChange={(event) => {
          const raw = event.target.value;
          onCommit(raw === '' ? undefined : Number(raw));
        }}
      />
    );
  }
  if (dataType === 'BOOLEAN' || dataType === 'BOOL') {
    return (
      <select
        value={value === true ? 'true' : value === false ? 'false' : ''}
        onChange={(event) => {
          const raw = event.target.value;
          onCommit(raw === '' ? undefined : raw === 'true');
        }}
      >
        <option value="">Sin valor</option>
        <option value="true">Verdadero</option>
        <option value="false">Falso</option>
      </select>
    );
  }
  if (STRUCTURED.has(dataType)) {
    return (
      <textarea
        rows={3}
        className="code-input"
        // `key` fuerza a remontar cuando el valor cambia desde fuera (al cargar un caso
        // generado o importado): un textarea no controlado ignoraría el nuevo defaultValue.
        key={JSON.stringify(value ?? null)}
        defaultValue={value === undefined ? '' : JSON.stringify(value, null, 2)}
        onBlur={(event) => {
          const raw = event.target.value.trim();
          if (raw === '') return onCommit(undefined);
          try {
            onCommit(JSON.parse(raw));
          } catch {
            onCommit(raw);
          }
        }}
      />
    );
  }
  return (
    <input
      value={value === undefined || value === null ? '' : String(value)}
      onChange={(event) => {
        const raw = event.target.value;
        onCommit(raw === '' ? undefined : raw);
      }}
    />
  );
}
