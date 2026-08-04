import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TestCaseRunDetail } from './TestCaseRunDetail';

/**
 * La corrida sólo mostraba estado y, si el caso fallaba, las aserciones rotas.
 * De un caso que PASA no se veía nada: ni entradas, ni resultado, ni el camino
 * recorrido. Sin eso no se puede revisar POR QUÉ aprobó, que es exactamente lo
 * que pregunta un auditor — y los datos ya venían en la respuesta.
 */
const APROBADO = {
  id: '33',
  resultStatus: 'PASS',
  durationMs: 139,
  actualResultJson: {
    decision_outcome: 'APPROVED',
    reasonCodes: ['APPROVED_POLICY'],
    trace: {
      nodes: ['START', 'COMPUTE_IDENTITY', 'APPROVE_RESULT'],
      terminal: 'APPROVE_RESULT',
    },
  },
  errorJson: null,
  testCase: {
    caseCode: 'APPROVE_LOW_RISK',
    testName: 'Aprueba solicitante verificado y de bajo riesgo',
    inputJson: { age: 34, bureau_score: 820 },
    expectedResultJson: { decision_outcome: 'APPROVED', reasonCodes: ['APPROVED_POLICY'] },
  },
  assertions: [
    {
      assertionPath: '$.decision_outcome',
      operator: 'EQUALS',
      expectedJson: 'APPROVED',
      passed: true,
    },
  ],
};

describe('detalle de un caso de la corrida', () => {
  it('va plegado: una corrida de veintiún casos no debe abrirse entera', () => {
    render(<TestCaseRunDetail caseRun={APROBADO} />);
    expect(screen.getByText('APPROVE_LOW_RISK')).toBeInTheDocument();
    expect(screen.queryByText('Lo que se comprobó')).not.toBeInTheDocument();
  });

  it('al abrir un caso que PASÓ enseña entradas, resultado y recorrido', () => {
    render(<TestCaseRunDetail caseRun={APROBADO} />);
    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByText('Lo que se comprobó')).toBeInTheDocument();
    // El camino recorrido: lo que antes no se veía de ningún caso.
    expect(screen.getByText('COMPUTE_IDENTITY')).toBeInTheDocument();
    // Aparece dos veces a propósito: como paso del camino y como final alcanzado.
    expect(screen.getAllByText('APPROVE_RESULT').length).toBeGreaterThanOrEqual(2);
    // Y con qué entró.
    expect(screen.getByText('bureau_score')).toBeInTheDocument();
  });

  it('marca el campo que no coincide, que es la respuesta a «por qué falló»', () => {
    const fallido = {
      ...APROBADO,
      resultStatus: 'FAIL',
      actualResultJson: { ...APROBADO.actualResultJson, decision_outcome: 'DECLINED' },
    };
    const { container } = render(<TestCaseRunDetail caseRun={fallido} />);
    fireEvent.click(screen.getByRole('button'));
    expect(container.querySelectorAll('.case-run-mismatch')).toHaveLength(1);
  });

  it('un caso sin traza no rompe: simplemente no muestra recorrido', () => {
    const sinTraza = { ...APROBADO, actualResultJson: { decision_outcome: 'APPROVED' } };
    render(<TestCaseRunDetail caseRun={sinTraza} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.queryByText('Camino que siguió')).not.toBeInTheDocument();
    expect(screen.getByText('Lo que se comprobó')).toBeInTheDocument();
  });
});
