'use client';

import { CheckCircle2, XCircle } from 'lucide-react';
import { formatDate } from '../../config/locale';
import { dataTypeLabel, variableOriginLabel } from '../../contracts/data-types';
import { display, type UnknownRecord } from '../../utils/records';
import { ConstraintDetails } from './ConstraintDetails';
import { VariableVersionSources } from './VariableVersionSources';

/**
 * El historial del contrato, con cada versión desplegada entera.
 *
 * Era una tabla de seis columnas donde las restricciones cabían en una celda, así
 * que el contrato se resumía a «4 valores permitidos» y todo lo demás que el motor
 * guarda por versión —unidad, valor por omisión, ejemplos, fuentes, reglas— no se
 * mostraba en ninguna parte del portal.
 */
export function VariableVersionList({ versions }: { versions: UnknownRecord[] }) {
  if (!versions.length) {
    return (
      <p className="field-hint">
        Esta variable todavía no tiene ninguna versión de contrato: el motor no puede validar
        valores para ella.
      </p>
    );
  }

  return (
    <ul className="variable-version-list">
      {versions.map((version) => {
        const current = !version.effectiveTo;
        return (
          <li key={display(version, 'id')} className="variable-version">
            <div className="variable-version-head">
              <b>v{display(version, 'versionNumber')}</b>
              <span className={current ? 'version-state is-current' : 'version-state'}>
                {current ? 'vigente' : 'reemplazada'}
              </span>
              <span>{dataTypeLabel(version.dataType)}</span>
              <small>
                Vigente desde {formatDate(version.effectiveFrom)}
                {version.effectiveTo ? ` hasta ${formatDate(version.effectiveTo)}` : ''}
              </small>
            </div>

            <ConstraintDetails
              dataType={version.dataType}
              constraints={version.constraintsJson ?? version.validationSchemaJson}
              nullable={version.nullable}
            />

            <dl className="definition-grid">
              <div>
                <dt>Origen esperado</dt>
                <dd>{variableOriginLabel(version.expectedOrigin)}</dd>
              </div>
              <div>
                <dt>Unidad</dt>
                <dd className="mono">{display(version, 'unitCode')}</dd>
              </div>
              <div>
                <dt>Valor por omisión</dt>
                <dd className="mono">{jsonText(version.defaultValueJson)}</dd>
              </div>
            </dl>

            {version.validationMessage ? (
              <p className="constraint-note">
                Mensaje que devuelve el motor al rechazar: «{display(version, 'validationMessage')}»
              </p>
            ) : null}

            {version.exampleValidJson !== null && version.exampleValidJson !== undefined ? (
              <p className="constraint-example is-valid">
                <CheckCircle2 size={14} aria-hidden /> Ejemplo que el contrato acepta:{' '}
                <code>{jsonText(version.exampleValidJson)}</code>
              </p>
            ) : null}
            {version.exampleInvalidJson !== null && version.exampleInvalidJson !== undefined ? (
              <p className="constraint-example is-invalid">
                <XCircle size={14} aria-hidden /> Ejemplo que el contrato rechaza:{' '}
                <code>{jsonText(version.exampleInvalidJson)}</code>
              </p>
            ) : null}

            <VariableVersionSources version={version} />
          </li>
        );
      })}
    </ul>
  );
}

/** Un JSON del contrato, legible; `—` si la versión no lo declara. */
function jsonText(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return typeof value === 'string' ? value : JSON.stringify(value);
}
