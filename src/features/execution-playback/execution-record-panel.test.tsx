import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { asRows } from '../../utils/records';
import { NodeVariableStatePanel } from '../graph-editor/NodeVariableStatePanel';
import contract from '../../contracts/fixtures/audit-execution.example.json';
import { flattenExecution } from './execution-record';

describe('Estado de variables por nodo con la respuesta real del motor', () => {
  it('muestra el valor que tenía cada variable al llegar al nodo, sin datos personales', () => {
    const execution = flattenExecution(contract as Record<string, unknown>);
    render(<NodeVariableStatePanel trace={asRows(execution.traceSteps)} />);

    expect(screen.getAllByText('monthly_income').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/5[.,]?200/).length).toBeGreaterThan(0);
    expect(screen.queryByText('0000000')).toBeNull();
  });
});
