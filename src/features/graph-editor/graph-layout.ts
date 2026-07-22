import { display, type UnknownRecord } from '../../utils/records';

/**
 * Produces a deterministic left-to-right layout while keeping disconnected
 * nodes visible in a final column.
 */
export function layoutGraphNodes(nodes: UnknownRecord[], edges: UnknownRecord[]): UnknownRecord[] {
  if (!nodes.length) return nodes;

  const keys = new Set(nodes.map((node) => display(node, 'key')));
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, string[]>();
  for (const key of keys) {
    incoming.set(key, 0);
    outgoing.set(key, []);
  }
  for (const edge of edges) {
    const from = display(edge, 'from');
    const to = display(edge, 'to');
    if (!keys.has(from) || !keys.has(to)) continue;
    outgoing.get(from)?.push(to);
    incoming.set(to, (incoming.get(to) ?? 0) + 1);
  }

  const startKey = display(nodes.find((node) => node.type === 'START') ?? {}, 'key');
  const roots = nodes
    .map((node) => display(node, 'key'))
    .filter((key) => key === startKey || (incoming.get(key) ?? 0) === 0);
  const queue = roots.map((key) => ({ key, level: 0 }));
  const levels = new Map<string, number>();

  while (queue.length) {
    const current = queue.shift();
    if (!current) continue;
    if (levels.has(current.key)) continue;
    levels.set(current.key, current.level);
    for (const target of outgoing.get(current.key) ?? []) {
      queue.push({ key: target, level: current.level + 1 });
    }
  }

  const connectedMax = Math.max(0, ...levels.values());
  for (const node of nodes) {
    const key = display(node, 'key');
    if (!levels.has(key)) levels.set(key, connectedMax + 1);
  }

  const columns = new Map<number, string[]>();
  for (const node of nodes) {
    const key = display(node, 'key');
    const level = levels.get(key) ?? 0;
    columns.set(level, [...(columns.get(level) ?? []), key]);
  }

  const maxLevel = Math.max(0, ...columns.keys());
  return nodes.map((node) => {
    const key = display(node, 'key');
    const level = levels.get(key) ?? 0;
    const column = columns.get(level) ?? [key];
    const row = Math.max(0, column.indexOf(key));
    const x = maxLevel ? 5 + (level / maxLevel) * 72 : 38;
    const y = column.length === 1 ? 43 : 8 + (row / (column.length - 1)) * 76;
    return { ...node, x: +x.toFixed(2), y: +y.toFixed(2) };
  });
}
