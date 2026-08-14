import { describeConstraints, parseConstraints } from '../../contracts/constraints';
import { explainConstraints } from '../../contracts/constraint-details';
import { dataTypeLabel } from '../../contracts/data-types';
import { asStrings, display, type UnknownRecord } from '../../utils/records';
import { ERROR_POLICY_LABELS, type ErrorPolicy } from './calculated-field.types';

interface Props {
  version: UnknownRecord;
}

/**
 * Qué devuelve la versión y qué pasa cuando no puede devolverlo.
 *
 * Las tres políticas del contrato —dato que falta, división entre cero, resultado
 * fuera de rango— se pintaban como pares sueltos dentro de una rejilla de tres
 * columnas, sin envolver cada `dt`/`dd` en su celda: las etiquetas y los valores
 * caían en columnas distintas y «FUERA DE RANGO» aparecía separado de su valor.
 * Además decían el nombre de la política («RETURN_DEFAULT») pero no lo que implica,
 * que es lo único que hace falta para saber qué recibirá quien consuma el campo.
 */
export function CalculatedFieldResultContract({ version }: Props) {
  const returns = (version.returns ?? {}) as UnknownRecord;
  const constraints = parseConstraints(returns.constraints);
  const range = describeConstraints(constraints);
  const details = explainConstraints(returns.dataType, constraints);
  const declaredCode = display(returns, 'errorCode');
  const errorCode = declaredCode === '—' ? '' : declaredCode;
  const nullable = returns.nullable === true;
  const hasDefault = version.defaultValue !== undefined && version.defaultValue !== null;
  const precision = typeof returns.precision === 'number' ? returns.precision : undefined;

  return (
    <div className="result-contract">
      <section className="result-contract-range">
        <h4>Dentro de rango</h4>
        <p>
          Devuelve <b>{dataTypeLabel(returns.dataType)}</b>
          {precision !== undefined ? `, redondeado a ${precision} decimales` : ''}
          {range.length ? `, y el resultado tiene que quedar ${range.join(' · ')}` : ''}.
          {nullable ? ' Puede devolver vacío.' : ' No puede devolver vacío.'}
        </p>
        {details.length ? (
          <ul className="constraint-rows">
            {details.map((detail) => (
              <li key={detail.key}>
                <span className="constraint-row-label">{detail.label}</span>
                <code className="constraint-row-value">{detail.value}</code>
                <span className="constraint-row-note">{detail.note}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="constraint-note">
            Sin rango declarado: cualquier resultado del tipo se devuelve tal cual.
          </p>
        )}
        <p className="constraint-note">
          El redondeo se aplica ANTES de comprobar el rango, así que un valor límite puede entrar
          por redondeo. Un resultado que cumple todo se devuelve como <code>VALID</code>.
        </p>
      </section>

      <div className="result-contract-policies">
        <PolicyCard
          title="Fuera de rango"
          when="El cálculo terminó, pero su resultado incumple el rango de arriba."
          policy={returns.outOfRange}
          errorCode={errorCode}
          nullable={nullable}
          hasDefault={hasDefault}
        />
        <PolicyCard
          title="Si falta un dato de entrada"
          when="Falta una entrada obligatoria, o un argumento no se pudo convertir."
          policy={returns.missingData}
          errorCode={errorCode}
          nullable={nullable}
          hasDefault={hasDefault}
          note="Sólo cubre datos ausentes o inconvertibles. Una avería (sandbox caído, tiempo agotado, librería no autorizada) se propaga siempre como error."
        />
        <PolicyCard
          title="División entre cero"
          when="El cálculo divide por cero, o acaba sin valor y el contrato no admite vacío."
          policy={returns.divisionByZero}
          errorCode={errorCode}
          nullable={nullable}
          hasDefault={hasDefault}
        />
      </div>

      {asStrings(returns.nullConditions).length ? (
        <section>
          <h4>Cuándo devuelve vacío a propósito</h4>
          <ul className="constraint-rules">
            {asStrings(returns.nullConditions).map((condition) => (
              <li key={condition}>{condition}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

interface PolicyProps {
  title: string;
  when: string;
  policy: unknown;
  errorCode: string;
  nullable: boolean;
  hasDefault: boolean;
  note?: string;
}

function PolicyCard({ title, when, policy, errorCode, nullable, hasDefault, note }: PolicyProps) {
  const code = String(policy ?? 'FAIL') as ErrorPolicy;
  const outcome = policyOutcome(code, errorCode, nullable, hasDefault);

  return (
    <section className="policy-card">
      <h4>{title}</h4>
      <p className="policy-when">{when}</p>
      <p className="policy-effect">
        <b>{ERROR_POLICY_LABELS[code] ?? code}</b>
      </p>
      <p className={outcome.broken ? 'policy-outcome is-broken' : 'policy-outcome'}>
        {outcome.text}
      </p>
      {note ? <p className="constraint-note">{note}</p> : null}
    </section>
  );
}

/**
 * Qué recibe de verdad quien consume el campo. `RETURN_NULL` sólo devuelve vacío si
 * el contrato admite nulos y `RETURN_DEFAULT` sólo si hay valor por defecto: en
 * cuanto falta esa condición el motor NO aplica la política y propaga el error, así
 * que anunciar «devuelve el valor por defecto» sería mentira.
 */
function policyOutcome(
  policy: ErrorPolicy,
  errorCode: string,
  nullable: boolean,
  hasDefault: boolean,
): { text: string; broken: boolean } {
  if (policy === 'RETURN_NULL' && !nullable) {
    return {
      text: 'La versión pide devolver vacío pero el contrato NO admite nulos: el motor propaga el error.',
      broken: true,
    };
  }
  if (policy === 'RETURN_DEFAULT' && !hasDefault) {
    return {
      text: 'La versión pide devolver el valor por defecto y NO declara ninguno: el motor propaga el error.',
      broken: true,
    };
  }
  if (policy === 'RETURN_NULL') {
    return { text: 'El campo entrega vacío; quien lo consuma debe tratar el nulo.', broken: false };
  }
  if (policy === 'RETURN_DEFAULT') {
    return { text: 'El campo entrega el valor por defecto de esta versión.', broken: false };
  }
  return {
    text: `La ejecución falla con ${errorCode || 'el código de error declarado'} y el artefacto que lo usa no recibe valor.`,
    broken: false,
  };
}
