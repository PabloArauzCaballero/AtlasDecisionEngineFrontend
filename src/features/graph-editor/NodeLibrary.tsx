import { Braces, Calculator, CircleDot, GitBranch, ShieldAlert, Split, Target } from 'lucide-react';

const groups = [
  {
    title: 'Estructura del flujo',
    items: [
      [CircleDot, 'Inicio', 'Punto único de entrada', 'START'],
      [GitBranch, 'Condición', 'Divide el flujo en dos rutas (if / else)', 'CONDITION'],
      [Split, 'Switch', 'Enruta en múltiples casos según una variable', 'SWITCH'],
    ] as const,
  },
  {
    title: 'Cálculo con código',
    items: [
      [Braces, 'Expresión', 'Calcula un valor con código JS o Python', 'EXPRESSION'],
      [Calculator, 'Score', 'Calcula un puntaje con código JS o Python', 'SCORE'],
    ] as const,
  },
  {
    title: 'Acciones y resultados',
    items: [
      [ShieldAlert, 'Revisión manual', 'Deriva el caso a un analista', 'MANUAL_REVIEW'],
      [Target, 'Resultado', 'Define la decisión final', 'RESULT'],
      [CircleDot, 'Fin', 'Cierra el flujo sin resultado', 'END'],
    ] as const,
  },
];

export function NodeLibrary({ onAddNode }: { onAddNode: (type: string) => void }) {
  return (
    <aside className="node-library" aria-label="Biblioteca de nodos">
      <div className="workbench-heading">
        <strong>Bloques del algoritmo</strong>
        <small>Arrastra al lienzo o pulsa para agregar</small>
      </div>
      {groups.map((group) => (
        <section key={group.title}>
          <h3>{group.title}</h3>
          {group.items.map(([Icon, label, description, type]) => (
            <button
              key={label}
              type="button"
              className={`library-node library-node-${type.toLowerCase()}`}
              draggable
              aria-label={`Agregar nodo ${label}`}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = 'copy';
                event.dataTransfer.setData('application/x-node-type', type);
              }}
              onClick={() => onAddNode(type)}
            >
              <span className="library-node-icon">
                <Icon size={16} />
              </span>
              <span>
                <strong>{label}</strong>
                <small>{description}</small>
              </span>
              <b aria-hidden="true">＋</b>
            </button>
          ))}
        </section>
      ))}
      <div className="library-tip">
        <strong>Consejo</strong>
        <span>Todo flujo debe comenzar en Inicio y terminar en Resultado, Revisión o Fin.</span>
      </div>
    </aside>
  );
}
