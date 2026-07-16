import { CircleDot, GitBranch, ShieldAlert, Target } from 'lucide-react';

const groups = [
  {
    title: 'Logic Nodes',
    items: [
      [CircleDot, 'Start', 'START'],
      [GitBranch, 'Condition', 'CONDITION'],
    ] as const,
  },
  {
    title: 'Actions & Outputs',
    items: [
      [ShieldAlert, 'Manual Review', 'MANUAL_REVIEW'],
      [Target, 'Result', 'RESULT'],
      [CircleDot, 'Terminal', 'END'],
    ] as const,
  },
];

export function NodeLibrary({ onAddNode }: { onAddNode: (type: string) => void }) {
  return (
    <aside className="node-library">
      <div className="workbench-heading">
        <strong>Library</strong>
        <small>Drag or click to add to canvas</small>
      </div>
      {groups.map((group) => (
        <section key={group.title}>
          <h3>{group.title}</h3>
          {group.items.map(([Icon, label, type]) => (
            <button
              key={label}
              type="button"
              draggable
              onDragStart={(event) => event.dataTransfer.setData('application/x-node-type', type)}
              onClick={() => onAddNode(type)}
            >
              <Icon size={16} />
              <span>{label}</span>
              <b>＋</b>
            </button>
          ))}
        </section>
      ))}
    </aside>
  );
}
