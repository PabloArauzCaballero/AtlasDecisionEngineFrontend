'use client';

import type { ReferenceFormState } from './reference-authoring';
import { OptionSelect } from '../../components/OptionSelect';
import { REFERENCE_TRACE_HELP, VERSION_SELECTION_HELP, closedOptions } from './graph-editor-help';
import { CheckField, Field } from '../../components/Field';

interface Props {
  form: ReferenceFormState;
  onPatch: (next: Partial<ReferenceFormState>) => void;
}

/**
 * Política de ejecución de una referencia entre artefactos (§9).
 *
 * Vive aparte del editor de referencias porque son decisiones de gobierno —qué versión,
 * en qué ambiente, cuántos reintentos, qué se ve en la traza— y no de mapeo de datos.
 * Sin estos campos había que llamar a la API a mano para configurarlos.
 */
export function ReferencePolicyFields({ form, onPatch }: Props) {
  return (
    <details className="reference-policy">
      <summary>Política de ejecución</summary>
      <div className="constraint-grid">
        <Field
          className="constraint-field"
          label="Ambiente del algoritmo referenciado"
          tooltip="Ambiente del que se toma la subdecisión. Ej.: PROD. Debe existir allí un despliegue activo."
        >
          <input
            placeholder="vacío = el mismo que este flujo"
            value={form.environmentCode}
            onChange={(event) => onPatch({ environmentCode: event.target.value.toUpperCase() })}
          />
        </Field>

        <Field
          className="constraint-field"
          label="Qué versión se ejecuta"
          tooltip="Si se llama siempre a la misma versión o a la que esté desplegada en ese momento."
        >
          <OptionSelect
            name="versionSelection"
            value={form.versionSelection}
            onChange={(value) =>
              onPatch({
                versionSelection: value as ReferenceFormState['versionSelection'],
              })
            }
            options={closedOptions(
              [
                { value: 'EXACT', label: 'La versión fijada (reproducible)' },
                { value: 'ACTIVE_IN_ENVIRONMENT', label: 'La activa del ambiente' },
              ],
              VERSION_SELECTION_HELP,
            )}
          />
        </Field>

        <Field
          className="constraint-field"
          label="Reintentos ante error transitorio"
          tooltip="Cuántas veces se repite la llamada si falla por un corte pasajero; 0 para no reintentar."
        >
          <input
            type="number"
            min={0}
            max={3}
            value={form.maxRetries}
            onChange={(event) => onPatch({ maxRetries: Number(event.target.value) })}
          />
        </Field>

        <Field
          className="constraint-field"
          label="Espera entre reintentos (ms)"
          tooltip="Milisegundos entre un intento y el siguiente. Ej.: 500. Sólo aplica si hay reintentos."
        >
          <input
            type="number"
            min={0}
            max={5000}
            step={50}
            disabled={form.maxRetries === 0}
            value={form.retryDelayMs}
            onChange={(event) => onPatch({ retryDelayMs: Number(event.target.value) })}
          />
        </Field>

        <CheckField
          className="constraint-field constraint-checkbox"
          label="Obligatoria: si falla, la decisión falla"
          tooltip="Márcalo si sin esta subdecisión no se puede decidir; si no, se sigue sin su resultado."
        >
          <input
            type="checkbox"
            checked={form.isRequired}
            onChange={(event) => onPatch({ isRequired: event.target.checked })}
          />
        </CheckField>

        <Field
          className="constraint-field"
          label="Qué se ve del resultado en la traza"
          tooltip="Cuánto del resultado de la subdecisión queda registrado en la traza de esta ejecución."
        >
          <OptionSelect
            name="tracePolicy"
            value={form.tracePolicy}
            onChange={(value) =>
              onPatch({ tracePolicy: value as ReferenceFormState['tracePolicy'] })
            }
            options={closedOptions(
              [
                { value: 'FULL', label: 'El resultado completo' },
                { value: 'MASKED', label: 'Enmascarado' },
                { value: 'REDACTED', label: 'Solo metadatos' },
                { value: 'EXCLUDED', label: 'Nada' },
              ],
              REFERENCE_TRACE_HELP,
            )}
          />
        </Field>

        <Field
          className="constraint-field constraint-wide"
          label="Condición de ejecución (JSON; vacío = siempre se ejecuta)"
          tooltip='Expresión que decide si se llama a la subdecisión. Ej.: {"op":"gt","left":{"var":"monto"},"right":{"value":1000}}.'
        >
          <textarea
            rows={2}
            spellCheck={false}
            placeholder={'{"op":"gt","left":{"var":"score"},"right":{"value":600}}'}
            value={form.executionCondition}
            onChange={(event) => onPatch({ executionCondition: event.target.value })}
          />
        </Field>
      </div>

      <small className="field-hint">
        En PROD la versión debe ser exacta: resolver «la activa del ambiente» haría que la misma
        entrada diera resultados distintos según cuándo se ejecute.
      </small>
    </details>
  );
}
