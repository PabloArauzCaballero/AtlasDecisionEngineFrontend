import type { UnknownRecord } from '../utils/records';
import { display } from '../utils/records';

export interface DefinitionItem {
  label: string;
  keys: string[];
  mono?: boolean;
}

export function DefinitionGrid({
  record,
  items,
}: {
  record: UnknownRecord;
  items: readonly DefinitionItem[];
}) {
  return (
    <dl className="definition-grid">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd className={item.mono ? 'mono' : undefined}>{display(record, ...item.keys)}</dd>
        </div>
      ))}
    </dl>
  );
}
