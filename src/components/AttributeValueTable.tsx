import type { ReactNode } from 'react';

const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

function formatCell(value: unknown): ReactNode {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'object') return <code className="mono">{JSON.stringify(value)}</code>;
  const text = String(value);
  if (typeof value === 'string' && ISO_DATETIME.test(text)) {
    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleString('es', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  }
  return text;
}

/**
 * Tabla atributo → valor generada automáticamente desde cualquier objeto. Es la
 * cara legible de una respuesta: cada campo con su valor formateado (fechas,
 * booleanos en español, objetos anidados como JSON compacto).
 */
export function AttributeValueTable({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data ?? {});
  if (!entries.length) {
    return <p className="empty-state">No hay atributos para mostrar.</p>;
  }
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th scope="col">Atributo</th>
            <th scope="col">Valor</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([key, value]) => (
            <tr key={key}>
              <td className="mono">{key}</td>
              <td>{formatCell(value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
