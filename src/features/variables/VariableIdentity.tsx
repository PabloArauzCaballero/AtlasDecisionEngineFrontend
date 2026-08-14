import { Alert } from '../../components/Alert';
import { SENSITIVITY_LABELS, type SensitivityClass } from '../../contracts/data-types';
import { display, type UnknownRecord } from '../../utils/records';

/**
 * La identidad de la variable y las restricciones que NO dependen de la versión:
 * su clasificación y, sobre todo, si la ley limita para qué se puede usar.
 *
 * `decisionUseRestriction` es una restricción tan real como un `max`, y más cara de
 * incumplir: `PROHIBITED_BASIS` marca una base prohibida por ECOA §1002.6(b)(9) y no
 * admite excepción por configuración. El portal la recibía y no la pintaba.
 */
const USE_RESTRICTIONS: Readonly<Record<string, string>> = {
  PROHIBITED_BASIS:
    'Base prohibida: la ley (ECOA §1002.6(b)(9), Reg B) impide que este dato influya en una decisión de crédito. El motor rechaza el artefacto que la consuma.',
  SPECIAL_CATEGORY:
    'Categoría especial (LGPD art. 11): sólo puede usarse si la versión que la consume declara su base legal.',
};

const LIFECYCLE_LABELS: Readonly<Record<string, string>> = {
  DRAFT: 'Borrador',
  ACTIVE: 'Activa',
  DEPRECATED: 'Obsoleta',
  RETIRED: 'Retirada',
};

export function VariableIdentity({ variable }: { variable: UnknownRecord }) {
  const restriction = display(variable, 'decisionUseRestriction');
  const warning = USE_RESTRICTIONS[restriction];
  const sensitivity = display(variable, 'sensitivityClass');

  return (
    <>
      {warning ? <Alert tone="error">{warning}</Alert> : null}
      <dl className="definition-grid">
        <div>
          <dt>Código</dt>
          <dd className="mono">{display(variable, 'variableCode')}</dd>
        </div>
        <div>
          <dt>Sensibilidad</dt>
          <dd>{SENSITIVITY_LABELS[sensitivity as SensitivityClass] ?? sensitivity}</dd>
        </div>
        <div>
          <dt>Clasificación del dato</dt>
          <dd>{display(variable, 'dataClassification')}</dd>
        </div>
        <div>
          <dt>Equipo responsable</dt>
          <dd>{display(variable, 'ownerTeam')}</dd>
        </div>
        <div>
          <dt>Estado</dt>
          <dd>
            {LIFECYCLE_LABELS[display(variable, 'lifecycleState')] ??
              display(variable, 'lifecycleState')}
            {variable.isActive === false ? ' · inactiva' : ''}
          </dd>
        </div>
        <div>
          <dt>Uso en decisiones</dt>
          <dd>{restriction === 'NONE' ? 'Sin restricción legal declarada' : restriction}</dd>
        </div>
      </dl>
    </>
  );
}
