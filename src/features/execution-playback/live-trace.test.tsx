import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { LiveNodeStep } from '../../components/LiveNodeStepList';
import { LiveGraph } from './LiveGraph';
import { liveTrace, versionIdFromEvent } from './live-trace';

const NODES = [
  { key: 'INICIO', type: 'START', label: 'Inicio', x: 6, y: 30 },
  { key: 'VALIDA', type: 'CONDITION', label: 'Validación de datos', x: 30, y: 30 },
  { key: 'RESULTADO', type: 'RESULT', label: 'Resultado final', x: 60, y: 30, terminal: true },
];
const EDGES = [
  { key: 'e1', from: 'INICIO', to: 'VALIDA' },
  { key: 'e2', from: 'VALIDA', to: 'RESULTADO' },
];

const EVENTS: LiveNodeStep[] = [
  { status: 'COMPLETED', nodeKey: 'INICIO', nodeType: 'START' },
  { status: 'RUNNING', nodeKey: 'VALIDA', nodeType: 'CONDITION' },
];

describe('liveTrace', () => {
  it('traduce los eventos del stream al modelo de pasos de la reproducción', () => {
    const steps = liveTrace(EVENTS);

    expect(steps).toHaveLength(2);
    expect(steps[0]).toMatchObject({ nodeKey: 'INICIO', status: 'done' });
    expect(steps[1]).toMatchObject({ nodeKey: 'VALIDA', status: 'running' });
  });

  it('colapsa los reenvíos del mismo nodo conservando su estado más reciente', () => {
    const steps = liveTrace([
      ...EVENTS,
      { status: 'COMPLETED', nodeKey: 'VALIDA', nodeType: 'CONDITION', branchTaken: 'e2' },
    ]);

    expect(steps).toHaveLength(2);
    expect(steps[1]).toMatchObject({ status: 'done', branchTaken: 'e2' });
  });

  it('mantiene el orden de llegada aunque un nodo se actualice después', () => {
    const steps = liveTrace([
      ...EVENTS,
      { status: 'COMPLETED', nodeKey: 'RESULTADO', nodeType: 'RESULT' },
      { status: 'COMPLETED', nodeKey: 'INICIO', nodeType: 'START' },
    ]);

    expect(steps.map((step) => step.nodeKey)).toEqual(['INICIO', 'VALIDA', 'RESULTADO']);
  });

  it('adopta la versión que declare el motor y descarta lo que no lo sea', () => {
    expect(versionIdFromEvent({ artifactVersionId: 'ver-1' })).toBe('ver-1');
    expect(versionIdFromEvent({ versionId: 'ver-2' })).toBe('ver-2');
    expect(versionIdFromEvent({ nodeKey: 'INICIO' })).toBeNull();
    expect(versionIdFromEvent(null)).toBeNull();
  });
});

describe('LiveGraph', () => {
  it('pide elegir la versión cuando todavía no hay grafo que dibujar', () => {
    render(<LiveGraph events={EVENTS} nodes={[]} edges={[]} running />);

    expect(screen.getByText(/Elige la versión para ver el recorrido/)).toBeInTheDocument();
  });

  it('ilumina el nodo en curso y deja pendientes los que aún no se han evaluado', () => {
    render(<LiveGraph events={EVENTS} nodes={NODES} edges={EDGES} running />);

    expect(screen.getByRole('button', { name: /Inicio, nodo Inicio, Completado/ })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /Validación de datos, nodo Condición, En ejecución/ }),
    ).toBeTruthy();
    // Mientras la ejecución sigue viva, lo no visitado es pendiente, no omitido:
    // todavía puede ejecutarse.
    expect(
      screen.getByRole('button', { name: /Resultado final, nodo Resultado, Pendiente/ }),
    ).toBeTruthy();
  });

  it('marca omitido lo que nunca se ejecutó una vez terminada la ejecución', () => {
    render(
      <LiveGraph
        events={[{ status: 'COMPLETED', nodeKey: 'INICIO', nodeType: 'START' }]}
        nodes={NODES}
        edges={EDGES}
        running={false}
      />,
    );

    expect(
      screen.getByRole('button', { name: /Resultado final, nodo Resultado, Omitido/ }),
    ).toBeTruthy();
  });
});
