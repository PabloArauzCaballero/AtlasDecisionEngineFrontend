'use client';

import { FlaskConical } from 'lucide-react';
import { OutcomeWeightsField } from './OutcomeWeightsField';
import { GENERATED_SEED, QA_SEED_CATALOG, describeSeed } from './seed-catalog';
import { Field } from '../../components/Field';
import { OptionSelect } from '../../components/OptionSelect';

/**
 * Cuántas semillas del historial se ofrecen. El desplegable es para ELEGIR entre lotes
 * conocidos; con las veinte últimas dentro vuelve a ser una lista en la que hay que buscar.
 */
const MAX_USED_SEEDS = 8;

export interface QaRunConfig {
  environmentCode: string;
  caseCount: number;
  seed: string;
  validPercent: number;
  boundaryPercent: number;
  invalidPercent: number;
  concurrency: number;
  timeoutMs: number;
  stopOnFirstFailure: boolean;
  checkDeterminism: boolean;
  /** Un caso por cada desenlace del grafo, además de los de la mezcla. */
  coverOutcomes: boolean;
  /** Pesos relativos por desenlace para repartir la porción válida. Vacío = sin reparto. */
  outcomeWeights: Record<string, number>;
}

export const DEFAULT_QA_CONFIG: QaRunConfig = {
  environmentCode: 'DEV',
  caseCount: 200,
  seed: '',
  validPercent: 60,
  boundaryPercent: 15,
  invalidPercent: 25,
  concurrency: 8,
  timeoutMs: 120_000,
  stopOnFirstFailure: false,
  checkDeterminism: false,
  coverOutcomes: true,
  outcomeWeights: {},
};

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
        <Field
          className="constraint-field"
          label={'Ambiente'}
          tooltip="Ambiente del motor contra el que se lanzan los casos de la corrida."
        >
          <OptionSelect
            name="ambiente"
            value={config.environmentCode}
            onChange={(valor) => patch({ environmentCode: valor })}
            options={['DEV', 'TEST', 'STAGING'].map((codigo) => ({
              value: codigo, // sin-ayuda: códigos de ambiente del motor
              label: codigo,
            }))}
          />
        </Field>
        <Field
          className="constraint-field"
          label="Número de casos"
          tooltip="Cuántos casos genera la corrida, hasta 5000."
        >
          <input
            type="number"
            min={1}
            max={5000}
            value={config.caseCount}
            onChange={(event) => patch({ caseCount: Number(event.target.value) })}
          />
        </Field>
        <Field
          className="constraint-field"
          label={'Semilla'}
          tooltip="Semilla del generador: la misma semilla produce el mismo lote de casos."
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
                  'El motor crea una semilla nueva y la devuelve para poder repetir el lote.',
              },
              ...QA_SEED_CATALOG.map((entry) => ({
                value: entry.seed,
                label: `Catálogo · ${entry.label}`,
                description: entry.hint,
              })),
              // Una semilla tecleada o heredada que no está en ninguna lista se conserva: sin ella el
              // desplegable la enseñaría vacía y parecería perdida.
              ...(loose ? [{ value: config.seed, label: config.seed }] : []), // sin-ayuda: semilla suelta, sin ficha
              ...used.map((seed) => ({
                value: seed, // sin-ayuda: semillas ya usadas en esta versión, sin ficha
                label: `Ya usada · ${seed}`,
              })),
            ]}
          />
        </Field>
        <Field
          className="constraint-field"
          label="Concurrencia"
          tooltip="Cuántos casos ejecuta el motor a la vez, hasta 32."
        >
          <input
            type="number"
            min={1}
            max={32}
            value={config.concurrency}
            onChange={(event) => patch({ concurrency: Number(event.target.value) })}
          />
        </Field>
        <Field
          className="constraint-field"
          label="% casos válidos"
          tooltip="Porcentaje de casos que cumplen el contrato."
        >
          <input
            type="number"
            min={0}
            max={100}
            value={config.validPercent}
            onChange={(event) => patch({ validPercent: Number(event.target.value) })}
          />
        </Field>
        <Field
          className="constraint-field"
          label="% casos de frontera"
          tooltip="Porcentaje de casos en el límite de las restricciones."
        >
          <input
            type="number"
            min={0}
            max={100}
            value={config.boundaryPercent}
            onChange={(event) => patch({ boundaryPercent: Number(event.target.value) })}
          />
        </Field>
        <Field
          className="constraint-field"
          label="% casos inválidos"
          tooltip="Porcentaje de casos que el contrato debe rechazar."
        >
          <input
            type="number"
            min={0}
            max={100}
            value={config.invalidPercent}
            onChange={(event) => patch({ invalidPercent: Number(event.target.value) })}
          />
        </Field>
        <Field
          className="constraint-field"
          label="Tiempo máximo (ms)"
          tooltip="Tope de tiempo de la corrida, en milisegundos."
        >
          <input
            type="number"
            min={1000}
            max={600000}
            step={1000}
            value={config.timeoutMs}
            onChange={(event) => patch({ timeoutMs: Number(event.target.value) })}
          />
        </Field>
        <label className="constraint-field constraint-checkbox">
          <input
            type="checkbox"
            checked={config.stopOnFirstFailure}
            onChange={(event) => patch({ stopOnFirstFailure: event.target.checked })}
          />
          <span>Parar en el primer contraejemplo</span>
        </label>
        <label className="constraint-field constraint-checkbox">
          <input
            type="checkbox"
            checked={config.checkDeterminism}
            onChange={(event) => patch({ checkDeterminism: event.target.checked })}
          />
          <span>Comprobar determinismo (ejecuta cada caso dos veces)</span>
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
          Esos casos se SUMAN a los {config.caseCount} de la mezcla: cuántos hay lo decide el grafo,
          no esta pantalla. Los porcentajes describen la ENTRADA —si respeta el contrato— y con
          ellos una tanda de mil casos válidos puede recorrer siempre la misma rama; esto asegura
          que cada decisión que el algoritmo sabe tomar se ejecuta al menos una vez.
        </p>
      ) : null}

      <OutcomeWeightsField
        versionId={versionId}
        weights={config.outcomeWeights}
        onChange={(outcomeWeights) => patch({ outcomeWeights })}
      />

      {mixTotal !== 100 ? (
        <p className="field-hint">
          La mezcla suma {mixTotal} %. Se normalizará proporcionalmente al repartir los{' '}
          {config.caseCount} casos.
        </p>
      ) : null}
      <p className="field-hint">
        PROD no está disponible a propósito: una corrida generativa mete miles de ejecuciones
        sintéticas y contaminaría los datos y las métricas reales.
      </p>

      <div className="panel-actions">
        <button
          type="button"
          className="button button-primary"
          disabled={pending || disabled}
          onClick={onRun}
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
