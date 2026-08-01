import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ExecutionPlayback } from './ExecutionPlayback';
import { normalizeTrace } from './execution-trace';

const NODES = [
  { key: 'INICIO', type: 'START', label: 'Inicio', x: 5, y: 20 },
  { key: 'VALIDA', type: 'CONDITION', label: 'Validación de datos', x: 30, y: 20 },
  { key: 'RIESGO', type: 'SCORE', label: 'Evaluación de riesgo', x: 55, y: 20 },
  { key: 'RESULTADO', type: 'RESULT', label: 'Resultado final', x: 80, y: 20, terminal: true },
];

const EDGES = [
  { key: 'e1', from: 'INICIO', to: 'VALIDA' },
  { key: 'e2', from: 'VALIDA', to: 'RIESGO' },
  { key: 'e3', from: 'VALIDA', to: 'RESULTADO', default: true },
];

const STEPS = normalizeTrace({
  traceSteps: [
    { nodeKey: 'INICIO', nodeType: 'START', status: 'COMPLETED', durationMs: 1 },
    {
      nodeKey: 'VALIDA',
      nodeType: 'CONDITION',
      status: 'COMPLETED',
      branchTaken: 'e2',
      discardedEdgeKeys: ['e3'],
      durationMs: 6,
    },
    {
      nodeKey: 'RIESGO',
      nodeType: 'SCORE',
      status: 'FAILED',
      errorMessage: 'Falta la variable score_base',
      childArtifactVersionId: 'ver-9',
    },
  ],
});

function renderPlayback() {
  return render(<ExecutionPlayback steps={STEPS} nodes={NODES} edges={EDGES} />);
}

describe('ExecutionPlayback', () => {
  it('explica que no hay recorrido cuando la ejecución no trae traza', () => {
    render(<ExecutionPlayback steps={[]} nodes={NODES} edges={EDGES} />);

    expect(screen.getByText(/no registró un recorrido paso a paso/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reproducir' })).not.toBeInTheDocument();
  });

  it('ofrece los controles mínimos de reproducción', () => {
    renderPlayback();

    expect(screen.getByRole('button', { name: 'Reproducir' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Paso siguiente' })).toBeEnabled();
    // En el primer paso no hay nada hacia atrás que reproducir.
    expect(screen.getByRole('button', { name: 'Paso anterior' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Velocidad|Lenta/i })).toBeTruthy();
  });

  it('avanza paso a paso y anuncia la posición', () => {
    renderPlayback();

    expect(screen.getByText(/Paso \d+ de \d+/).textContent).toContain('1');
    fireEvent.click(screen.getByRole('button', { name: 'Paso siguiente' }));
    expect(screen.getByText(/Paso \d+ de \d+/).textContent).toContain('2');
    expect(screen.getByRole('button', { name: 'Paso anterior' })).toBeEnabled();
  });

  it('distingue el nodo en ejecución, los completados y los no ejecutados', () => {
    renderPlayback();
    fireEvent.click(screen.getByRole('button', { name: 'Paso siguiente' }));

    expect(screen.getByRole('button', { name: /Inicio, nodo Inicio, Completado/ })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /Validación de datos, nodo Condición, En ejecución/ }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /Resultado final, nodo Resultado, Pendiente/ }),
    ).toBeTruthy();
  });

  it('muestra el error en el nodo que falló, no en otro', () => {
    renderPlayback();
    fireEvent.click(screen.getByRole('button', { name: 'Paso siguiente' }));
    fireEvent.click(screen.getByRole('button', { name: 'Paso siguiente' }));

    expect(
      screen.getByRole('button', { name: /Evaluación de riesgo, nodo Puntaje, Con error/ }),
    ).toBeTruthy();
    expect(screen.getByText('Falta la variable score_base')).toBeInTheDocument();
  });

  it('enlaza el algoritmo interno invocado por el paso', () => {
    renderPlayback();
    fireEvent.click(screen.getByRole('button', { name: 'Paso siguiente' }));
    fireEvent.click(screen.getByRole('button', { name: 'Paso siguiente' }));

    const link = screen.getByRole('link', { name: /Algoritmo interno invocado/ });
    expect(link).toHaveAttribute('href', '/artifact-versions/ver-9/graph');
  });

  it('explica en el tooltip de la conexión cuándo se toma y si se descartó', () => {
    renderPlayback();
    fireEvent.click(screen.getByRole('button', { name: 'Paso siguiente' }));
    fireEvent.click(screen.getByRole('button', { name: 'Paso siguiente' }));

    const discarded = screen.getByRole('button', { name: 'No / defecto' });
    expect(discarded.getAttribute('title')).toContain('NO se cumple');
    expect(discarded.getAttribute('title')).toContain('se descartó');
  });

  it('salta a un evento concreto desde la línea de tiempo', () => {
    renderPlayback();
    const timeline = screen.getByRole('list', { name: /Línea de tiempo/ });

    fireEvent.click(within(timeline).getByRole('button', { name: /RIESGO/ }));

    expect(screen.getByText(/Paso \d+ de \d+/).textContent).toContain('3');
    expect(screen.getByText('Falta la variable score_base')).toBeInTheDocument();
  });

  it('abre el detalle del nodo al pulsarlo en el grafo', () => {
    renderPlayback();

    fireEvent.click(screen.getByRole('button', { name: /Validación de datos, nodo Condición/ }));

    expect(screen.getByText(/Divide el flujo en dos caminos/)).toBeInTheDocument();
    expect(screen.getByText('e2')).toBeInTheDocument();
  });
});
