import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConstraintEditor } from './ConstraintEditor';
import { IntermediateVariableManager } from './IntermediateVariableManager';
import { OutputContractPanel } from './OutputContractPanel';
import { NodeVariableStatePanel } from './NodeVariableStatePanel';
import type { UnknownRecord } from '../../utils/records';

/**
 * Autoría de contratos en el editor (§1.2, §2, §3.1, §4).
 *
 * Lo que se prueba no es "el componente renderiza", sino que la UI produzca exactamente
 * la estructura que el backend valida: si aquí se guarda algo distinto, el autor
 * descubre el error al publicar y no mientras edita.
 */
const nodes: UnknownRecord[] = [
  { key: 'START', type: 'START', label: 'Inicio' },
  { key: 'CALC', type: 'EXPRESSION', label: 'Calcular' },
  { key: 'FIN', type: 'RESULT', label: 'Resultado' },
];

describe('ConstraintEditor', () => {
  it('solo ofrece restricciones que aplican al tipo', () => {
    const { rerender } = render(
      <ConstraintEditor dataType="DECIMAL" constraints={{}} onChange={vi.fn()} />,
    );
    expect(screen.getByText('Valor mínimo')).toBeInTheDocument();
    expect(screen.queryByText('Longitud mínima')).not.toBeInTheDocument();

    rerender(<ConstraintEditor dataType="STRING" constraints={{}} onChange={vi.fn()} />);
    expect(screen.getByText('Longitud mínima')).toBeInTheDocument();
    expect(screen.queryByText('Valor mínimo')).not.toBeInTheDocument();
  });

  it('emite la restricción normalizada al cambiarla', () => {
    const onChange = vi.fn();
    render(<ConstraintEditor dataType="DECIMAL" constraints={{}} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Valor mínimo'), { target: { value: '10' } });
    expect(onChange).toHaveBeenCalledWith({ min: 10 });
  });

  it('elimina la restricción cuando el campo se vacía', () => {
    const onChange = vi.fn();
    render(<ConstraintEditor dataType="DECIMAL" constraints={{ min: 10 }} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Valor mínimo'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith({});
  });

  it('avisa cuando el valor de ejemplo incumple el contrato', () => {
    render(<ConstraintEditor dataType="DECIMAL" constraints={{ max: 5 }} onChange={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Probar un valor de ejemplo'), {
      target: { value: '9' },
    });
    expect(screen.getByText(/no puede superar 5/)).toBeInTheDocument();
  });

  it('confirma cuando el ejemplo sí cumple', () => {
    render(<ConstraintEditor dataType="DECIMAL" constraints={{ max: 5 }} onChange={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Probar un valor de ejemplo'), {
      target: { value: '3' },
    });
    expect(screen.getByText(/cumple el contrato/)).toBeInTheDocument();
  });
});

describe('IntermediateVariableManager', () => {
  it('crea la intermedia con productor y política de escritura por defecto', () => {
    const onChange = vi.fn();
    render(<IntermediateVariableManager intermediates={[]} nodes={nodes} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Código de la nueva variable intermedia'), {
      target: { value: 'dti' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Añadir intermedia' }));

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        code: 'dti',
        producerNodeKey: 'START',
        updatePolicy: 'SINGLE_WRITE',
        sensitivityClass: 'INTERNAL',
        tracePolicy: 'FULL',
      }),
    ]);
  });

  it('no permite dos intermedias con el mismo código', () => {
    const onChange = vi.fn();
    render(
      <IntermediateVariableManager
        intermediates={[{ code: 'dti', name: 'DTI', dataType: 'DECIMAL', producerNodeKey: 'CALC' }]}
        nodes={nodes}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByLabelText('Código de la nueva variable intermedia'), {
      target: { value: 'dti' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Añadir intermedia' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('sin nodos no deja declarar intermedias: no habría quién las cree', () => {
    render(<IntermediateVariableManager intermediates={[]} nodes={[]} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Añadir intermedia' })).toBeDisabled();
  });
});

describe('OutputContractPanel', () => {
  const outputs: UnknownRecord[] = [
    { code: 'decision', usageType: 'OUTPUT_PRIMARY', dataType: 'STRING', required: true },
    { code: 'motivo', usageType: 'OUTPUT', dataType: 'STRING', required: false },
  ];

  it('avisa de las salidas sin origen declarado', () => {
    render(
      <OutputContractPanel
        variables={outputs}
        intermediates={[]}
        nodes={nodes}
        outputContract={[]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/2 salida\(s\) sin origen declarado/)).toBeInTheDocument();
  });

  it('declara de golpe las que faltan con un origen por defecto', () => {
    const onChange = vi.fn();
    render(
      <OutputContractPanel
        variables={outputs}
        intermediates={[]}
        nodes={nodes}
        outputContract={[]}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Declarar las 2 que faltan/ }));
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ code: 'decision', sourceKind: 'NODE', sourceRef: 'START' }),
      expect.objectContaining({ code: 'motivo', sourceKind: 'NODE' }),
    ]);
  });

  it('solo pide motivos de ausencia en los campos opcionales', () => {
    render(
      <OutputContractPanel
        variables={outputs}
        intermediates={[]}
        nodes={nodes}
        outputContract={[
          { code: 'decision', sourceKind: 'NODE', sourceRef: 'FIN', absenceReasons: [] },
          { code: 'motivo', sourceKind: 'NODE', sourceRef: 'FIN', absenceReasons: [] },
        ]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getAllByText('Motivos por los que puede faltar (uno por línea)')).toHaveLength(1);
  });
});

describe('NodeVariableStatePanel', () => {
  const trace: UnknownRecord[] = [
    {
      nodeKey: 'CALC',
      variableState: {
        nodeKey: 'CALC',
        inputs: [
          {
            code: 'ingreso',
            dataType: 'DECIMAL',
            state: 'VALID',
            value: 1000,
            sensitivityClass: 'INTERNAL',
          },
          {
            code: 'documento',
            dataType: 'STRING',
            state: 'VALID',
            value: '12345678',
            sensitivityClass: 'PII',
          },
        ],
        intermediatesBefore: [
          {
            code: 'dti',
            dataType: 'DECIMAL',
            state: 'NOT_AVAILABLE',
            value: null,
            producerNodeKey: 'CALC',
            consumedByNodeKeys: [],
          },
        ],
        intermediatesAfter: [
          {
            code: 'dti',
            dataType: 'DECIMAL',
            state: 'COMPUTED',
            value: 0.4,
            producerNodeKey: 'CALC',
            consumedByNodeKeys: ['FIN'],
            createdAtStepIndex: 1,
          },
        ],
        intermediatesCreated: ['dti'],
        intermediatesUpdated: [],
        outputs: [
          {
            code: 'decision',
            dataType: 'STRING',
            state: 'NOT_AVAILABLE',
            value: null,
            sensitivityClass: 'INTERNAL',
          },
        ],
      },
    },
  ];

  it('separa entradas, intermedias y salidas', () => {
    render(<NodeVariableStatePanel trace={trace} />);
    expect(screen.getByText('Entradas recibidas')).toBeInTheDocument();
    expect(screen.getByText('Variables intermedias')).toBeInTheDocument();
    expect(screen.getByText('Salidas publicadas')).toBeInTheDocument();
    expect(screen.getByText(/Creadas aquí: dti/)).toBeInTheDocument();
  });

  it('dice en qué paso se creó la intermedia (§3.1)', () => {
    render(<NodeVariableStatePanel trace={trace} />);
    // El backend numera desde 0 y la traza se lee desde 1: mostrar el índice crudo
    // haría que el analista buscara el paso equivocado.
    expect(screen.getByText('paso 2')).toBeInTheDocument();
  });

  it('nunca muestra en claro el valor de un dato sensible', () => {
    render(<NodeVariableStatePanel trace={trace} />);
    expect(screen.queryByText('12345678')).not.toBeInTheDocument();
    expect(screen.getByText('•••')).toBeInTheDocument();
  });

  it('explica la ausencia de estado en ejecuciones antiguas', () => {
    render(<NodeVariableStatePanel trace={[{ nodeKey: 'CALC' }]} />);
    expect(screen.getByText(/versión anterior del motor/)).toBeInTheDocument();
  });
});
