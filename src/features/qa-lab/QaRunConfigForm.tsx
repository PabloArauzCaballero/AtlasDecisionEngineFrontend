'use client';

import { FlaskConical } from 'lucide-react';

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
}

export const DEFAULT_QA_CONFIG: QaRunConfig = {
  environmentCode: 'SANDBOX',
  caseCount: 200,
  seed: '',
  validPercent: 60,
  boundaryPercent: 15,
  invalidPercent: 25,
  concurrency: 8,
  timeoutMs: 120_000,
  stopOnFirstFailure: false,
  checkDeterminism: false,
};

interface Props {
  config: QaRunConfig;
  pending: boolean;
  disabled: boolean;
  onChange: (config: QaRunConfig) => void;
  onRun: () => void;
}

/** Configuración de una corrida generativa (§10.4). */
export function QaRunConfigForm({ config, pending, disabled, onChange, onRun }: Props) {
  const patch = (change: Partial<QaRunConfig>) => onChange({ ...config, ...change });
  const mixTotal = config.validPercent + config.boundaryPercent + config.invalidPercent;

  return (
    <div className="qa-config">
      <div className="constraint-grid">
        <label className="constraint-field">
          <span>Ambiente</span>
          <select
            value={config.environmentCode}
            onChange={(event) => patch({ environmentCode: event.target.value })}
          >
            <option value="SANDBOX">SANDBOX</option>
            <option value="TEST">TEST</option>
          </select>
        </label>
        <label className="constraint-field">
          <span>Número de casos</span>
          <input
            type="number"
            min={1}
            max={5000}
            value={config.caseCount}
            onChange={(event) => patch({ caseCount: Number(event.target.value) })}
          />
        </label>
        <label className="constraint-field">
          <span>Semilla (vacío = generada)</span>
          <input
            value={config.seed}
            placeholder="para reproducir una corrida anterior"
            onChange={(event) => patch({ seed: event.target.value })}
          />
        </label>
        <label className="constraint-field">
          <span>Concurrencia</span>
          <input
            type="number"
            min={1}
            max={32}
            value={config.concurrency}
            onChange={(event) => patch({ concurrency: Number(event.target.value) })}
          />
        </label>
        <label className="constraint-field">
          <span>% casos válidos</span>
          <input
            type="number"
            min={0}
            max={100}
            value={config.validPercent}
            onChange={(event) => patch({ validPercent: Number(event.target.value) })}
          />
        </label>
        <label className="constraint-field">
          <span>% casos de frontera</span>
          <input
            type="number"
            min={0}
            max={100}
            value={config.boundaryPercent}
            onChange={(event) => patch({ boundaryPercent: Number(event.target.value) })}
          />
        </label>
        <label className="constraint-field">
          <span>% casos inválidos</span>
          <input
            type="number"
            min={0}
            max={100}
            value={config.invalidPercent}
            onChange={(event) => patch({ invalidPercent: Number(event.target.value) })}
          />
        </label>
        <label className="constraint-field">
          <span>Tiempo máximo (ms)</span>
          <input
            type="number"
            min={1000}
            max={600000}
            step={1000}
            value={config.timeoutMs}
            onChange={(event) => patch({ timeoutMs: Number(event.target.value) })}
          />
        </label>
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
      </div>

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
          <FlaskConical size={14} aria-hidden />{' '}
          {pending ? 'Generando y ejecutando…' : `Generar ${config.caseCount} casos`}
        </button>
      </div>
    </div>
  );
}
