import {
  describeConstraints,
  parseConstraints,
  type VariableConstraints,
} from '../../contracts/constraints';
import {
  describeCondition,
  describeScopeMatch,
  SCOPE_AXES,
} from '../../contracts/constraint-scopes';

/**
 * Los tramos que sólo aplican a veces: reglas condicionales sobre otro campo y
 * restricciones acotadas por país, producto, ambiente, tenant o versión.
 *
 * El motor las aplana sobre la base antes de validar (`resolveConstraints`), así que
 * omitirlas hacía que la ficha describiera un contrato MÁS PERMISIVO que el real.
 */
export function ScopedConstraintList({ constraints }: { constraints: VariableConstraints }) {
  const axes = SCOPE_AXES.filter((axis) => constraints[axis.key]?.length);
  if (!constraints.conditional?.length && !axes.length) return null;

  return (
    <div className="constraint-scopes">
      {constraints.conditional?.length ? (
        <section>
          <h4>Reglas condicionales</h4>
          <ul className="constraint-rules">
            {constraints.conditional.map((rule, index) => (
              <li key={`${rule.whenField}-${index}`}>
                <b>{describeCondition(rule)}</b>
                <span>
                  {rule.required ? 'la variable pasa a ser obligatoria. ' : ''}
                  {summarize(rule.constraints)}
                </span>
                {rule.message ? <em>{rule.message}</em> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {axes.map((axis) => (
        <section key={axis.key}>
          <h4>{axis.label}</h4>
          <ul className="constraint-rules">
            {(constraints[axis.key] ?? []).map((entry, index) => (
              <li key={`${axis.key}-${index}`}>
                <b>{describeScopeMatch(entry)}</b>
                <span>{summarize(entry.constraints)}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Las restricciones del tramo, ya legibles; sin ellas el tramo no cambia nada. */
function summarize(constraints: unknown): string {
  const parts = describeConstraints(parseConstraints(constraints));
  return parts.length ? `se aplica ${parts.join(' · ')}.` : 'no añade ningún límite.';
}
