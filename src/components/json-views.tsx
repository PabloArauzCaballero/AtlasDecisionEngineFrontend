import { ArrowRight } from 'lucide-react';

/** One flattened key → value row for the table view. */
interface KvRow {
  path: string;
  value: string;
}

function scalarText(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  return String(value);
}

/** Flattens any value into dot-path key/value rows (arrays indexed) for a table. */
export function flattenToRows(value: unknown, prefix = '', out: KvRow[] = []): KvRow[] {
  if (Array.isArray(value)) {
    if (!value.length) out.push({ path: prefix || '(lista)', value: '[]' });
    value.forEach((item, index) =>
      flattenToRows(item, prefix ? `${prefix}[${index}]` : `[${index}]`, out),
    );
  } else if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (!entries.length) out.push({ path: prefix || '(objeto)', value: '{}' });
    for (const [key, val] of entries) flattenToRows(val, prefix ? `${prefix}.${key}` : key, out);
  } else {
    out.push({ path: prefix || '(valor)', value: scalarText(value) });
  }
  return out;
}

const STEP_KEYS = ['nodeKey', 'nodeType', 'step', 'sequence', 'nodeId', 'branchTaken'];

function isStep(item: unknown): item is Record<string, unknown> {
  return (
    Boolean(item) &&
    typeof item === 'object' &&
    !Array.isArray(item) &&
    STEP_KEYS.some((key) => key in (item as Record<string, unknown>))
  );
}

/** Finds a "path/trace" array anywhere in the value (execution steps), for the graphic view. */
export function findSteps(value: unknown, depth = 0): Record<string, unknown>[] | null {
  if (depth > 4) return null;
  if (Array.isArray(value) && value.length && value.every(isStep)) {
    return value as Record<string, unknown>[];
  }
  if (value && typeof value === 'object') {
    for (const val of Object.values(value as Record<string, unknown>)) {
      const found = findSteps(val, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

export function TableView({ value }: { value: unknown }) {
  const rows = flattenToRows(value);
  return (
    <div className="table-wrap json-table-wrap">
      <table className="json-table">
        <thead>
          <tr>
            <th scope="col">Campo</th>
            <th scope="col">Valor</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.path}-${index}`}>
              <td className="mono">{row.path}</td>
              <td>{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const label = (step: Record<string, unknown>): string =>
  scalarText(step.nodeKey ?? step.step ?? step.nodeId ?? step.sequence ?? '·');
const sublabel = (step: Record<string, unknown>): string =>
  scalarText(step.nodeType ?? step.branchTaken ?? '');

/**
 * Graphic view: an execution trace becomes a left-to-right sequence of "fases"
 * (the path the decision took), each a card with an arrow to the next — easy to
 * read for any user. Anything else falls back to an indented hierarchical tree.
 */
export function GraphView({ value }: { value: unknown }) {
  const steps = findSteps(value);
  if (steps) {
    return (
      <div className="json-phases">
        {steps.map((step, index) => (
          <div className="json-phase" key={index}>
            <div className="json-phase-card">
              <span className="json-phase-index">{index + 1}</span>
              <div>
                <b>{label(step)}</b>
                {sublabel(step) !== '—' ? <small>{sublabel(step)}</small> : null}
              </div>
            </div>
            {index < steps.length - 1 ? (
              <ArrowRight className="json-phase-arrow" size={16} aria-hidden="true" />
            ) : null}
          </div>
        ))}
      </div>
    );
  }
  return <TreeView value={value} depth={0} />;
}

function TreeView({ value, depth }: { value: unknown; depth: number }) {
  if (Array.isArray(value)) {
    return (
      <div className="json-tree">
        {value.map((item, index) => (
          <div className="json-tree-node" key={index}>
            <span className="json-tree-key">[{index}]</span>
            <TreeView value={item} depth={depth + 1} />
          </div>
        ))}
      </div>
    );
  }
  if (value && typeof value === 'object') {
    return (
      <div className="json-tree">
        {Object.entries(value as Record<string, unknown>).map(([key, val]) => (
          <div className="json-tree-node" key={key}>
            <span className="json-tree-key">{key}</span>
            {val && typeof val === 'object' ? (
              <TreeView value={val} depth={depth + 1} />
            ) : (
              <span className="json-tree-value">{scalarText(val)}</span>
            )}
          </div>
        ))}
      </div>
    );
  }
  return <span className="json-tree-value">{scalarText(value)}</span>;
}
