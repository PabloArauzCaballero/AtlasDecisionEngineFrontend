'use client';

import { EmptyState } from '../../components/EmptyState';
import { ScrollRegion } from '../../components/ScrollRegion';
import { StatusBadge } from '../../components/StatusBadge';
import { NavLink } from '../../navigation/NavLink';
import { asRows, display, type UnknownRecord } from '../../utils/records';

interface Props {
  versions: UnknownRecord[];
}

/**
 * Qué artefactos invocan este campo calculado, y con qué versión suya.
 *
 * El motor lo devuelve en el detalle desde siempre (`versions[].usedBy`) y el portal no lo
 * enseñaba en ninguna parte, así que la pregunta que se hace ANTES de tocar una fórmula
 * compartida —«¿a quién rompo?»— sólo se podía contestar buscando a mano por los grafos.
 *
 * La versión importa tanto como el artefacto: cada artefacto congela la definición del
 * campo que usaba, así que dos artefactos pueden estar calculando cosas distintas con el
 * mismo nombre, y esta tabla es donde eso se ve.
 */
export function CalculatedFieldUsagePanel({ versions }: Props) {
  const uses = versions.flatMap((version) =>
    asRows(version.usedBy).map((use) => ({
      use,
      versionNumber: display(version, 'versionNumber'),
    })),
  );

  if (!uses.length) {
    return (
      <EmptyState
        illustration="empty"
        title="Ningún artefacto lo usa todavía"
        description="Nadie depende de este cálculo: se puede cambiar o retirar sin romper nada. En cuanto un algoritmo lo invoque aparecerá aquí, y su versión quedará congelada dentro de ese artefacto."
        example="Se invoca desde un nodo de campo calculado en el editor de grafos"
      />
    );
  }

  return (
    <ScrollRegion label="Artefactos que usan este campo calculado">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Artefacto</th>
            <th scope="col">Versión del artefacto</th>
            <th scope="col">Estado</th>
            <th scope="col">Usa la v</th>
            <th scope="col">Nodo</th>
            <th scope="col">Escribe en</th>
          </tr>
        </thead>
        <tbody>
          {uses.map(({ use, versionNumber }, index) => (
            <tr key={`${display(use, 'artifactVersionId')}-${display(use, 'callKey')}-${index}`}>
              <td>
                {/* Al grafo de ESA versión, que es donde se ve la llamada; el detalle del
                    artefacto enseñaría la última, que puede no ser la que invoca. */}
                <NavLink href={`/artifact-versions/${display(use, 'artifactVersionId')}/graph`}>
                  <code>{display(use, 'artifactCode')}</code>
                </NavLink>
                <small> {display(use, 'artifactName')}</small>
              </td>
              <td>
                v{display(use, 'versionNumber')} · {display(use, 'semanticVersion')}
              </td>
              <td>
                <StatusBadge value={display(use, 'status')} />
              </td>
              <td>v{versionNumber}</td>
              <td className="mono">{display(use, 'nodeKey')}</td>
              <td className="mono">{display(use, 'target')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollRegion>
  );
}
