import { ScrollRegion } from '../../components/ScrollRegion';
import { StatusBadge } from '../../components/StatusBadge';
import type { CoverageMatrix } from './coverage-matrix';

const LABELS: Record<string, string> = {
  COMPLETE: 'Completo',
  PARTIAL: 'Parcial',
  GAP: 'Hueco',
};

interface Props {
  matrix: CoverageMatrix;
}

/**
 * La rejilla objetivo × política.
 *
 * Una celda que no aplica se dibuja como raya, no como distintivo: un «Hueco»
 * donde no hay requisito es una acusación falsa, y con 702 de ellas en pantalla
 * los 27 huecos de verdad quedaban indistinguibles. La raya lleva su texto para
 * lectores de pantalla, que de otro modo oirían una celda vacía.
 */
export function CoverageMatrixGrid({ matrix }: Props) {
  return (
    <ScrollRegion label="Matriz de cobertura" data-tutorial-id="coverage-matrix-grid">
      <table>
        <thead>
          <tr>
            <th scope="col">Objetivo de negocio</th>
            {matrix.policies.map((policy) => (
              <th scope="col" key={policy.id}>
                {policy.policyCode}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map((row) => (
            <tr key={row.id}>
              <td>
                <strong>{row.objectiveCode}</strong>
                <small>{row.name}</small>
              </td>
              {row.cells.map((state, index) => (
                <td key={matrix.policies[index]?.id ?? index}>
                  {state === 'NOT_APPLICABLE' ? (
                    <>
                      <span className="coverage-na" aria-hidden="true">
                        —
                      </span>
                      <span className="sr-only">No aplica a este objetivo</span>
                    </>
                  ) : (
                    <StatusBadge value={state} labels={LABELS} />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollRegion>
  );
}
