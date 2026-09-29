import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CalculatedFieldVersionList } from './CalculatedFieldVersionList';
import { canPromoteCalculatedField, canProposeArtifactChange } from '../../auth/business-rules';

vi.mock('./CalculatedFieldTryPanel', () => ({
  CalculatedFieldTryPanel: () => <div data-testid="try-panel" />,
}));

const VERSIONS = [
  { id: '9', versionNumber: 1, status: 'DRAFT', implementationKind: 'SCRIPT', usedBy: [] },
];

/**
 * El motor sólo deja escribir, probar y publicar versiones de campos calculados a la autoría
 * (QA/FRAUD; publicar, también COMPLIANCE). La pantalla de detalle se abre con el permiso de
 * lectura, así que sin esto RISK_ANALYST, AUDITOR y COMPLIANCE veían botones que responden 403.
 */
describe('versiones de un campo calculado · qué ofrece cada rol', () => {
  it('RISK_ANALYST ni publica ni prueba', () => {
    const roles = ['RISK_ANALYST'];
    render(
      <CalculatedFieldVersionList
        versions={VERSIONS}
        onPromote={() => undefined}
        canPromote={canPromoteCalculatedField(roles)}
        canTry={canProposeArtifactChange(roles)}
      />,
    );
    expect(screen.queryByTestId('try-panel')).not.toBeInTheDocument();
    expect(screen.getByText(/requiere rol QA Analyst o Fraud Analyst/)).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1); // sólo desplegar la versión
  });

  it('QA_ANALYST publica y prueba', () => {
    const roles = ['QA_ANALYST'];
    render(
      <CalculatedFieldVersionList
        versions={VERSIONS}
        onPromote={() => undefined}
        canPromote={canPromoteCalculatedField(roles)}
        canTry={canProposeArtifactChange(roles)}
      />,
    );
    expect(screen.getByTestId('try-panel')).toBeInTheDocument();
    expect(screen.getAllByRole('button').length).toBeGreaterThan(1);
  });

  it('COMPLIANCE publica pero no prueba', () => {
    expect(canPromoteCalculatedField(['COMPLIANCE'])).toBe(true);
    expect(canProposeArtifactChange(['COMPLIANCE'])).toBe(false);
  });
});
