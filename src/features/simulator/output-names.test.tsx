import { render, screen } from '@testing-library/react';
import { SimulationResultPanel } from './SimulationResultPanel';
import { variableNames } from './useArtifactContract';
import type { BatchEntry } from './simulation-batch';

/**
 * Cómo se lee una decisión.
 *
 * El motor devuelve la salida indexada por el CÓDIGO de cada variable
 * (`ingreso_verificado`, `decision_extracto`) y publica su nombre en el
 * contrato («Ingreso verificado», «Decisión sobre el extracto»). La rejilla
 * enseñaba el código, así que quien miraba el resultado traducía identificadores
 * de cabeza — justo lo que el formulario de entrada de al lado ya había dejado
 * de pedir.
 */

const CONTRATO = {
  variables: [
    { variableCode: 'decision_extracto', canonicalName: 'Decisión sobre el extracto' },
    { variableCode: 'ingreso_verificado', canonicalName: 'Ingreso verificado' },
    // Sin nombre publicado: no se inventa ninguno.
    { variableCode: 'ext_diagnostico' },
  ],
};

function entradaCon(output: Record<string, unknown>): BatchEntry[] {
  return [
    {
      label: 'Caso 1',
      decision: {
        status: 'SUCCEEDED',
        outcome: 'APROBADO',
        output,
        primaryResult: { code: 'decision_extracto', value: 'APROBADO' },
        reasonCodes: [],
      },
    } as unknown as BatchEntry,
  ];
}

describe('nombres de las salidas de una simulación', () => {
  it('traduce cada código a su nombre publicado', () => {
    expect(variableNames(CONTRATO)).toEqual({
      decision_extracto: 'Decisión sobre el extracto',
      ingreso_verificado: 'Ingreso verificado',
    });
  });

  it('sin contrato no traduce nada, y no rompe', () => {
    expect(variableNames(undefined)).toEqual({});
  });

  it('enseña el nombre legible y conserva el código debajo', () => {
    render(
      <SimulationResultPanel
        entries={entradaCon({ ingreso_verificado: 39958.09 })}
        index={0}
        onIndex={() => {}}
        names={variableNames(CONTRATO)}
      />,
    );

    expect(screen.getByText('Ingreso verificado')).toBeInTheDocument();
    // El código no se esconde: es la clave del contrato y la que se usa al integrarse.
    expect(screen.getByText('ingreso_verificado')).toBeInTheDocument();
    expect(screen.getByText('39958.09')).toBeInTheDocument();
    expect(
      screen.getByText(/Resultado principal · Decisión sobre el extracto/),
    ).toBeInTheDocument();
  });

  /*
   * El contrato llega por red. Mientras no está —o si el artefacto no publica
   * nombre para una salida— se enseña el código, que es lo que había antes, y
   * no un rótulo inventado.
   */
  it('sin nombre publicado deja el código como único rótulo', () => {
    render(
      <SimulationResultPanel
        entries={entradaCon({ ext_diagnostico: 'OK' })}
        index={0}
        onIndex={() => {}}
        names={variableNames(CONTRATO)}
      />,
    );

    expect(screen.getAllByText('ext_diagnostico')).toHaveLength(1);
  });
});
