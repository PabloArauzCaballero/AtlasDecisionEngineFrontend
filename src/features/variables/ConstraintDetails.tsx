'use client';

import { CircleSlash2 } from 'lucide-react';
import {
  formatAllowedValue,
  parseConstraints,
  type VariableConstraints,
} from '../../contracts/constraints';
import { describeTypeShape, explainConstraints } from '../../contracts/constraint-details';
import { dataTypeLabel } from '../../contracts/data-types';
import { ScopedConstraintList } from './ScopedConstraintList';

interface Props {
  dataType: unknown;
  /** Contrato tal cual lo guarda el motor (`constraintsJson` o el esquema legado). */
  constraints: unknown;
  /** `nullable` de la versión: se explica junto al resto porque decide igual. */
  nullable?: unknown;
}

/**
 * Qué valores acepta el motor para una variable, restricción por restricción.
 *
 * La ficha resumía el contrato en una celda de tabla —«4 valores permitidos»—, que
 * es justo el dato que no sirve: para escribir una petición, probar un caso o
 * entender un rechazo hace falta saber CUÁLES son esos cuatro valores. Aquí se
 * enumeran, y cada límite dice qué pasa exactamente en el borde y con qué código
 * lo rechaza el motor.
 */
export function ConstraintDetails({ dataType, constraints, nullable }: Props) {
  const parsed: VariableConstraints = parseConstraints(constraints);
  const details = explainConstraints(dataType, parsed);
  const allowed = (parsed.allowedValues ?? []).map(formatAllowedValue);
  const nothingDeclared = !details.length && !allowed.length && !parsed.conditional?.length;

  return (
    <div className="constraint-details">
      <p className="constraint-shape">
        <b>{dataTypeLabel(dataType)}</b> — {describeTypeShape(dataType)}{' '}
        {nullable === true
          ? 'Admite nulos: puede llegar vacía y el motor la acepta.'
          : 'No admite nulos: tiene que llegar con valor en cada ejecución.'}
      </p>

      {allowed.length ? (
        <section className="constraint-allowed">
          <h4>
            Valores permitidos <span className="constraint-count">{allowed.length}</span>
          </h4>
          <ul className="allowed-values">
            {allowed.map((value) => (
              <li key={value}>
                <code>{value}</code>
              </li>
            ))}
          </ul>
          <p className="constraint-note">
            Cualquier otro valor se rechaza con <code>VALUE_NOT_ALLOWED</code>. La comparación es
            exacta: distingue mayúsculas, espacios y comillas.
          </p>
        </section>
      ) : null}

      {details.length ? (
        <ul className="constraint-rows">
          {details.map((detail) => (
            <li key={detail.key}>
              <span className="constraint-row-label">{detail.label}</span>
              <code className="constraint-row-value">{detail.value}</code>
              <span className="constraint-row-note">{detail.note}</span>
              <code className="constraint-row-code" title="Código con el que el motor lo rechaza">
                {detail.code}
              </code>
            </li>
          ))}
        </ul>
      ) : null}

      <ScopedConstraintList constraints={parsed} />

      {nothingDeclared ? (
        <p className="constraint-none">
          <CircleSlash2 size={14} aria-hidden /> Sin restricciones declaradas: el motor sólo
          comprueba la forma del tipo. Cualquier valor que encaje en {dataTypeLabel(dataType)} se
          acepta.
        </p>
      ) : null}
    </div>
  );
}
