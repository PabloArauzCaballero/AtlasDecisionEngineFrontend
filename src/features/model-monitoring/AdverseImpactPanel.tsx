'use client';

import { AlertTriangle, Info } from 'lucide-react';
import { Panel } from '../../components/Panel';
import { asRecord, asRows, display, type UnknownRecord } from '../../utils/records';
import { asPercent } from './useModelMonitoring';

/**
 * Impacto adverso: ¿trata igual a grupos comparables? (regla de los cuatro quintos)
 *
 * Dos cosas que esta pantalla dice y conviene leer bien.
 *
 * La primera: una razón por debajo de 0,8 **no es una conclusión de discriminación**. Obliga a
 * buscar y documentar la explicación de negocio, que es una obligación distinta y más útil que una
 * acusación automática.
 *
 * La segunda: los atributos que se miden aquí son justamente los que la normativa prohíbe usar al
 * DECIDIR. Que aparezcan en esta vista no es una contradicción — es la única forma de comprobar
 * que no se están usando. Por eso el motor los guarda por separado, agrupados en bandas, y sólo
 * los puede cargar quien audita.
 */
export function AdverseImpactPanel({ report }: { report: UnknownRecord }) {
  const data = asRecord(report);
  const groups = asRows(data.groups);
  const ignored = Array.isArray(data.ignoredForSmallSample)
    ? data.ignoredForSmallSample.map(String)
    : [];

  return (
    <Panel
      title="Impacto adverso"
      meta={`atributo ${String(data.attribute ?? '—')}`}
      tutorialId="monitoring-adverse"
    >
      {data.flagged === true ? (
        <p className="monitoring-note monitoring-note-warning">
          <AlertTriangle size={14} aria-hidden />
          <span>
            Algún grupo con muestra suficiente queda por debajo de 0,8 frente al grupo de referencia
            <b> {String(data.referenceGroup ?? '—')}</b>. Esto no concluye que haya discriminación:
            obliga a encontrar y dejar escrita la explicación de negocio.
          </span>
        </p>
      ) : (
        <p className="monitoring-note">
          <Info size={14} aria-hidden />
          <span>
            Ningún grupo con muestra suficiente cae por debajo de 0,8. Grupo de referencia:{' '}
            <b>{String(data.referenceGroup ?? '—')}</b>, el de mayor tasa de aprobación.
          </span>
        </p>
      )}

      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Grupo</th>
            <th scope="col">Casos</th>
            <th scope="col">Aprobados</th>
            <th scope="col">Tasa de aprobación</th>
            <th scope="col">Razón de impacto</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group, index) => (
            <tr
              key={`${display(group, 'group')}-${index}`}
              className={group.belowThreshold ? 'row-flagged' : undefined}
            >
              <td>{display(group, 'group')}</td>
              <td>{Number(group.total ?? 0).toLocaleString('es-BO')}</td>
              <td>{Number(group.approved ?? 0).toLocaleString('es-BO')}</td>
              <td>{asPercent(group.approvalRate)}</td>
              <td>{Number(group.impactRatio ?? 0).toFixed(3)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {ignored.length ? (
        <p className="monitoring-note">
          <Info size={14} aria-hidden />
          <span>
            Excluidos por muestra pequeña (menos de 30 casos): {ignored.join(', ')}. Su razón sería
            ruido, y publicarla como si midiera algo es peor que no publicarla.
          </span>
        </p>
      ) : null}

      <p className="monitoring-note">
        {Number(data.analyzed ?? 0).toLocaleString('es-BO')} decisiones analizadas.
      </p>
    </Panel>
  );
}
