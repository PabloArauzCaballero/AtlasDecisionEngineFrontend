import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NavigationProgressProvider } from '../../navigation/NavigationProgressProvider';
import { CalculatedFieldUsagePanel } from './CalculatedFieldUsagePanel';
import type { UnknownRecord } from '../../utils/records';

/** El enlace es un `NavLink`, y para alimentar la barra de progreso necesita su proveedor. */
function renderPanel(versions: UnknownRecord[]) {
  render(
    <NavigationProgressProvider>
      <CalculatedFieldUsagePanel versions={versions} />
    </NavigationProgressProvider>,
  );
}

/**
 * «¿A quién rompo si toco esta fórmula?» es la pregunta que se hace antes de editar un
 * campo compartido. El motor la contesta desde siempre en el detalle (`versions[].usedBy`)
 * y el portal no la enseñaba en ninguna parte.
 */
const VERSIONS = [
  {
    id: '6102',
    versionNumber: 2,
    usedBy: [],
  },
  {
    id: '6101',
    versionNumber: 1,
    usedBy: [
      {
        artifactCode: 'CREDIT_LIMIT_V2',
        artifactName: 'Asignación de límite',
        artifactVersionId: '4001',
        versionNumber: 3,
        semanticVersion: '1.2.0',
        status: 'DEPLOYED_TO_PROD',
        nodeKey: 'CALC_DTI',
        callKey: 'call_1',
        target: 'intermediate.debt_to_income_ratio',
      },
    ],
  },
];

describe('quién usa un campo calculado', () => {
  it('enseña el artefacto, su estado y QUÉ versión del campo invoca', () => {
    renderPanel(VERSIONS);

    expect(screen.getByText('CREDIT_LIMIT_V2')).toBeInTheDocument();
    expect(screen.getByText('v3 · 1.2.0')).toBeInTheDocument();
    // La versión del campo importa tanto como el artefacto: cada uno congela la
    // definición que usaba, así que dos pueden estar calculando cosas distintas.
    expect(screen.getByText('v1')).toBeInTheDocument();
    expect(screen.getByText('intermediate.debt_to_income_ratio')).toBeInTheDocument();
  });

  it('enlaza al grafo de ESA versión del artefacto, que es donde se ve la llamada', () => {
    renderPanel(VERSIONS);
    expect(screen.getByRole('link', { name: /CREDIT_LIMIT_V2/ })).toHaveAttribute(
      'href',
      '/artifact-versions/4001/graph',
    );
  });

  it('sin usos lo dice, porque eso significa que se puede cambiar sin romper nada', () => {
    renderPanel([{ id: '1', versionNumber: 1, usedBy: [] }]);
    expect(screen.getByText('Ningún artefacto lo usa todavía')).toBeInTheDocument();
  });
});
