'use client';

import type { ReferenceFormState } from './reference-authoring';

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
        <label className="constraint-field">
          <span>Ambiente del algoritmo referenciado</span>
          <input
            placeholder="vacío = el mismo que este flujo"
            value={form.environmentCode}
            onChange={(event) => onPatch({ environmentCode: event.target.value.toUpperCase() })}
          />
        </label>

        <label className="constraint-field">
          <span>Qué versión se ejecuta</span>
          <select
            value={form.versionSelection}
            onChange={(event) =>
              onPatch({
                versionSelection: event.target.value as ReferenceFormState['versionSelection'],
              })
            }
          >
            <option value="EXACT">La versión fijada (reproducible)</option>
            <option value="ACTIVE_IN_ENVIRONMENT">La activa del ambiente</option>
          </select>
        </label>

        <label className="constraint-field">
          <span>Reintentos ante error transitorio</span>
          <input
            type="number"
            min={0}
            max={3}
            value={form.maxRetries}
            onChange={(event) => onPatch({ maxRetries: Number(event.target.value) })}
          />
        </label>

        <label className="constraint-field">
          <span>Espera entre reintentos (ms)</span>
          <input
            type="number"
            min={0}
            max={5000}
            step={50}
            disabled={form.maxRetries === 0}
            value={form.retryDelayMs}
            onChange={(event) => onPatch({ retryDelayMs: Number(event.target.value) })}
          />
        </label>

        <label className="constraint-field constraint-checkbox">
          <input
            type="checkbox"
            checked={form.isRequired}
            onChange={(event) => onPatch({ isRequired: event.target.checked })}
          />
          <span>Obligatoria: si falla, la decisión falla</span>
        </label>

        <label className="constraint-field">
          <span>Qué se ve del resultado en la traza</span>
          <select
            value={form.tracePolicy}
            onChange={(event) =>
              onPatch({ tracePolicy: event.target.value as ReferenceFormState['tracePolicy'] })
            }
          >
            <option value="FULL">El resultado completo</option>
            <option value="MASKED">Enmascarado</option>
            <option value="REDACTED">Solo metadatos</option>
            <option value="EXCLUDED">Nada</option>
          </select>
        </label>

        <label className="constraint-field constraint-wide">
          <span>Condición de ejecución (JSON; vacío = siempre se ejecuta)</span>
          <textarea
            rows={2}
            spellCheck={false}
            placeholder={'{"op":"gt","left":{"var":"score"},"right":{"value":600}}'}
            value={form.executionCondition}
            onChange={(event) => onPatch({ executionCondition: event.target.value })}
          />
        </label>
      </div>

      <small className="field-hint">
        En PROD la versión debe ser exacta: resolver «la activa del ambiente» haría que la misma
        entrada diera resultados distintos según cuándo se ejecute.
      </small>
    </details>
  );
}
