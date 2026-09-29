'use client';

import { FlaskConical } from 'lucide-react';
import { OutcomeWeightsField } from './OutcomeWeightsField';
import { GENERATED_SEED, QA_SEED_CATALOG, describeSeed } from './seed-catalog';
import { Field } from '../../components/Field';
import { OptionSelect } from '../../components/OptionSelect';
import type { QaRunConfig } from './qa-run-config';

export { DEFAULT_QA_CONFIG, type QaRunConfig } from './qa-run-config';

/**
 * Cuántas semillas del historial se ofrecen. El desplegable es para ELEGIR entre lotes
 * conocidos; con las veinte últimas dentro vuelve a ser una lista en la que hay que buscar.
 */
const MAX_USED_SEEDS = 8;

interface Props {
  config: QaRunConfig;
  /** Versión elegida: de ella salen los desenlaces sobre los que se reparte. */
  versionId: string;
  /** Semillas ya usadas en esta versión, sacadas del historial. */
  usedSeeds: readonly string[];
  pending: boolean;
  disabled: boolean;
  onChange: (config: QaRunConfig) => void;
  onRun: () => void;
}

/** Un campo numérico del formulario, con su explicación. */
function NumberField(props: {
  label: string;
  tooltip: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <Field className="constraint-field" label={props.label} tooltip={props.tooltip}>
      <input
        type="number"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(event) => props.onChange(Number(event.target.value))}
      />
    </Field>
  );
}

/** Configuración de una corrida generativa (§10.4). */
export function QaRunConfigForm({
  config,
  versionId,
  usedSeeds,
  pending,
  disabled,
  onChange,
  onRun,
}: Props) {
  const patch = (change: Partial<QaRunConfig>) => onChange({ ...config, ...change });
  const mixTotal = config.validPercent + config.boundaryPercent + config.invalidPercent;
  const used = usedSeeds.slice(0, MAX_USED_SEEDS);
  const loose =
    config.seed !== GENERATED_SEED &&
    !used.includes(config.seed) &&
    !QA_SEED_CATALOG.some((entry) => entry.seed === config.seed);

  return (
    <div className="qa-config">
      <div className="constraint-grid">
        <NumberField
          label="Número de casos"
          tooltip="Cuántos casos inventa y ejecuta la corrida, hasta 5000, además de los de cada resultado si los añades."
          value={config.caseCount}
          min={1}
          max={5000}
          onChange={(caseCount) => patch({ caseCount })}
        />
        <Field
          className="constraint-field"
          label={'Semilla'}
          tooltip="El nombre del lote de datos. Con la misma semilla, la misma configuración y la misma versión se generan exactamente los mismos casos."
        >
          <OptionSelect
            name="semilla"
            value={config.seed}
            onChange={(valor) => patch({ seed: valor })}
            options={[
              {
                value: GENERATED_SEED,
                label: 'Generar una nueva',
                description:
                  'El motor crea una semilla nueva y la archiva con la corrida para poder repetirla.',
              },
              ...QA_SEED_CATALOG.map((entry) => ({
                value: entry.seed,
                label: `Catálogo · ${entry.label}`,
                description: entry.hint,
              })),
              // Una semilla heredada que no está en ninguna lista se conserva: sin ella el
              // desplegable la enseñaría vacía y parecería perdida.
              ...(loose ? [{ value: config.seed, label: config.seed }] : []), // sin-ayuda: semilla suelta, sin ficha
              ...used.map((seed) => ({
                value: seed, // sin-ayuda: semillas ya usadas en esta versión, sin ficha
                label: `Ya usada · ${seed}`,
              })),
            ]}
          />
        </Field>
        <NumberField
          label="Casos a la vez (concurrencia)"
          tooltip="Cuántos casos ejecuta el motor al mismo tiempo, de 1 a 32. Más va más rápido pero carga más al motor; no cambia los resultados."
          value={config.concurrency}
          min={1}
          max={32}
          onChange={(concurrency) => patch({ concurrency })}
        />
        <NumberField
          label="Tiempo máximo (segundos)"
          tooltip="Si la corrida tarda más, se corta y lo dice: los casos que falten no se ejecutan. Entre 1 y 600 segundos."
          value={Math.round(config.timeoutMs / 1000)}
          min={1}
          max={600}
          onChange={(seconds) => patch({ timeoutMs: seconds * 1000 })}
        />
        <NumberField
          label="% casos válidos"
          tooltip="Casos que cumplen todas las reglas del contrato: el motor debe aceptarlos y decidir."
          value={config.validPercent}
          min={0}
          max={100}
          onChange={(validPercent) => patch({ validPercent })}
        />
        <NumberField
          label="% casos en el límite"
          tooltip="Casos válidos pero pegados al borde de una regla (edad mínima exacta, monto máximo): ahí suelen esconderse los errores."
          value={config.boundaryPercent}
          min={0}
          max={100}
          onChange={(boundaryPercent) => patch({ boundaryPercent })}
        />
        <NumberField
          label="% casos inválidos"
          tooltip="Casos que rompen a propósito UNA regla del contrato: el motor debe rechazarlos."
          value={config.invalidPercent}
          min={0}
          max={100}
          onChange={(invalidPercent) => patch({ invalidPercent })}
        />
        <label className="constraint-field constraint-checkbox">
          <input
            type="checkbox"
            checked={config.stopOnFirstFailure}
            onChange={(event) => patch({ stopOnFirstFailure: event.target.checked })}
          />
          <span>Parar en el primer caso con fallo</span>
        </label>
        <label className="constraint-field constraint-checkbox">
          <input
            type="checkbox"
            checked={config.checkDeterminism}
            onChange={(event) => patch({ checkDeterminism: event.target.checked })}
          />
          <span>
            Comprobar determinismo: ejecuta cada caso dos veces y exige el mismo resultado
          </span>
        </label>
        <label className="constraint-field constraint-checkbox">
          <input
            type="checkbox"
            checked={config.coverOutcomes}
            onChange={(event) => patch({ coverOutcomes: event.target.checked })}
          />
          <span>Añadir un caso por cada resultado posible del algoritmo</span>
        </label>
      </div>

      <p className="field-hint">Semilla: {describeSeed(config.seed, used)}</p>

      {config.coverOutcomes ? (
        <p className="field-hint">
          Esos casos se suman a los {config.caseCount}: hay uno por cada resultado (aprobar,
          rechazar, revisar…) para que ninguno quede sin probar.
        </p>
      ) : null}

      <OutcomeWeightsField
        versionId={versionId}
        weights={config.outcomeWeights}
        onChange={(outcomeWeights) => patch({ outcomeWeights })}
      />

      {config.distributions.length ? (
        <p className="field-hint">
          Esta configuración viene de una corrida archivada y lleva {config.distributions.length}{' '}
          distribución(es) de valores ({config.distributions.map((d) => d.variableCode).join(', ')}
          ). Se reenvían tal cual para que el lote sea el mismo.
        </p>
      ) : null}

      {mixTotal !== 100 ? (
        <p className="field-hint">
          Los porcentajes suman {mixTotal} %: se ajustarán en proporción al repartir los{' '}
          {config.caseCount} casos.
        </p>
      ) : null}

      <p className="field-hint" data-tutorial-id="qa-lab-fakers">
        De dónde salen los datos: nombres, carnets, celulares, correos, ingresos y demás datos
        reconocibles por el nombre de la variable salen del <b>generador de datos realistas</b>, con
        la misma semilla; lo demás, del contrato. Si el generador no responde, todo sale del
        contrato y el resultado lo avisa.
      </p>

      <div className="panel-actions">
        <button
          type="button"
          className="button button-primary"
          disabled={pending || disabled}
          onClick={onRun}
          data-tutorial-id="qa-lab-launch"
        >
          {/* El rótulo cuenta también los casos por desenlace: decir «Generar 200 casos»
              cuando se van a ejecutar 200 más los finales del grafo hace que el informe
              no cuadre con lo que se pulsó. */}
          <FlaskConical size={14} aria-hidden />{' '}
          {pending
            ? 'Generando y ejecutando…'
            : `Generar ${config.caseCount} casos${config.coverOutcomes ? ' + los desenlaces' : ''}`}
        </button>
      </div>
    </div>
  );
}
