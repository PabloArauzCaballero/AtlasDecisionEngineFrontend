import { ShieldCheck } from 'lucide-react';
import { asRows, display, type UnknownRecord } from '../../utils/records';

/**
 * De dónde sale el valor y qué reglas extra lo validan.
 *
 * El motor guarda las dos cosas por versión (`sources`, `validationRules`) y las
 * devuelve en el detalle desde siempre; la ficha no las pintaba, así que un
 * contrato con un rango BLOQUEANTE declarado como regla se veía «sin restricciones».
 */
export function VariableVersionSources({ version }: { version: UnknownRecord }) {
  const sources = asRows(version.sources);
  const rules = asRows(version.validationRules);
  if (!sources.length && !rules.length) return null;

  return (
    <div className="variable-version-origins">
      {sources.length ? (
        <section>
          <h4>De dónde llega el valor</h4>
          <ul className="variable-source-list">
            {sources.map((source, index) => (
              <li key={display(source, 'id') + String(index)}>
                <b>{display(source, 'sourceSystemCode')}</b>
                <code>
                  {display(source, 'sourcePath')} → {display(source, 'sourceField')}
                </code>
                <span>
                  Prioridad {display(source, 'precedence')} · caduca a los{' '}
                  {display(source, 'freshnessSlaSeconds')} s
                </span>
                {source.isAuthoritative ? (
                  <span className="source-authoritative">
                    <ShieldCheck size={12} aria-hidden /> fuente autoritativa
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {rules.length ? (
        <section>
          <h4>Reglas de validación adicionales</h4>
          <ul className="variable-source-list">
            {rules.map((rule, index) => (
              <li key={display(rule, 'id') + String(index)}>
                <b>{display(rule, 'ruleType')}</b>
                <code>{JSON.stringify(rule.ruleConfigJson ?? {})}</code>
                <span>
                  {display(rule, 'severity') === 'BLOCKING'
                    ? 'Bloqueante: si no se cumple, la ejecución no sigue.'
                    : `Severidad ${display(rule, 'severity')}.`}
                </span>
                <code className="constraint-row-code">{display(rule, 'errorCode')}</code>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
