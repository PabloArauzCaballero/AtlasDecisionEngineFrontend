import { Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { InfoHint } from '../../components/InfoHint';
import type { UnknownRecord } from '../../utils/records';
import { asRecord, display } from '../../utils/records';
import { ConditionNodeEditor } from './ConditionNodeEditor';
import { DecisionTableNodeEditor } from './DecisionTableNodeEditor';
import { ExpressionNodeEditor } from './ExpressionNodeEditor';
import { ManualReviewNodeEditor } from './ManualReviewNodeEditor';
import { ResultNodeEditor } from './ResultNodeEditor';
import { SwitchNodeEditor } from './SwitchNodeEditor';

interface NodePropertiesProps {
  node: UnknownRecord;
  onChange: (patch: UnknownRecord) => void;
  onDelete: () => void;
  outputs?: UnknownRecord[];
  inputs?: UnknownRecord[];
  condition?: UnknownRecord;
  branchCount?: number;
  versionId?: string;
  onConditionChange?: (patch: UnknownRecord) => void;
}

/** Plain-language input→output role of a node, so the data flow is obvious. */
function dataFlowHint(type: string): string {
  switch (type) {
    case 'START':
      return 'Entrada: recibe las variables de entrada de la decisión. No produce salida.';
    case 'CONDITION':
      return 'Entrada: lee variables para decidir el camino. Salida: la rama (sí / no) según su regla.';
    case 'SWITCH':
      return 'Entrada: lee una variable. Salida: la rama del caso que coincide.';
    case 'EXPRESSION':
    case 'SCORE':
      return 'Entrada: variables que usa el cálculo. Salida: la variable destino que escribe.';
    case 'RESULT':
      return 'Entrada: variables del flujo. Salida: las variables de resultado (lo que devuelve la decisión).';
    case 'MANUAL_REVIEW':
      return 'Entrada: el caso y su evidencia. Salida: deriva a una persona (no decide automáticamente).';
    case 'END':
      return 'Cierra el flujo sin producir un resultado.';
    default:
      return 'Configura las entradas que lee y las salidas que escribe este paso.';
  }
}

export function NodeProperties({
  node,
  onChange,
  onDelete,
  outputs = [],
  inputs = [],
  condition = {},
  branchCount = 0,
  versionId = '',
  onConditionChange,
}: NodePropertiesProps) {
  const key = display(node, 'key');
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [config, setConfig] = useState('{}');
  const [configError, setConfigError] = useState<string | null>(null);

  useEffect(() => {
    setLabel(node.label !== undefined ? String(node.label) : '');
    setDescription(String(asRecord(node.config).description ?? ''));
    setConfig(JSON.stringify(node.config ?? {}, null, 2));
    setConfigError(null);
    // Only reload the form when the selected node changes — re-running on every
    // node.label/config change would overwrite in-progress edits after each commit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (key === '—' || !key) {
    return (
      <aside className="node-properties">
        <div className="workbench-heading">
          <strong>Propiedades del nodo</strong>
          <small>Selecciona un bloque del lienzo</small>
        </div>
        <section className="properties-empty-state">
          <strong>Ningún nodo seleccionado</strong>
          <p>Selecciona un bloque para configurar su nombre, lógica y comportamiento de salida.</p>
        </section>
      </aside>
    );
  }

  function commitConfig() {
    try {
      const parsed = JSON.parse(config || '{}');
      setConfigError(null);
      onChange({ config: parsed });
    } catch {
      setConfigError('JSON inválido, no se guardó el cambio.');
    }
  }

  return (
    <aside className="node-properties">
      <div className="workbench-heading">
        <strong>Propiedades del nodo</strong>
        <small>{key}</small>
      </div>
      <section>
        <h3>General</h3>
        <label className="field">
          <span>Clave del nodo</span>
          <input readOnly value={key} />
        </label>
        <label className="field">
          <span>Nombre visible</span>
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            onBlur={() => onChange({ label })}
          />
        </label>
        <label className="field">
          <span>
            Descripción del paso
            <InfoHint text="Explica en palabras simples QUÉ hace este paso y POR QUÉ, para que cualquier persona lo entienda sin ser técnica." />
          </span>
          <textarea
            rows={3}
            value={description}
            placeholder="Ej.: Comprueba que el cliente pasó KYC y dio su consentimiento antes de evaluar el riesgo."
            onChange={(event) => setDescription(event.target.value)}
            onBlur={() => onChange({ config: { ...asRecord(node.config), description } })}
          />
        </label>
        <label className="field">
          <span>Tipo</span>
          <input readOnly value={display(node, 'type')} />
        </label>
        <p className="node-io-hint">{dataFlowHint(display(node, 'type'))}</p>
      </section>
      {display(node, 'type') === 'CONDITION' && onConditionChange ? (
        <ConditionNodeEditor
          key={display(condition, 'code')}
          condition={condition}
          inputs={inputs}
          onChange={onConditionChange}
        />
      ) : null}
      {display(node, 'type') === 'SWITCH' ? (
        <SwitchNodeEditor
          config={
            node.config && typeof node.config === 'object' ? (node.config as UnknownRecord) : {}
          }
          inputs={inputs}
          branchCount={branchCount}
          onChange={(nextConfig) => onChange({ config: nextConfig })}
        />
      ) : null}
      {display(node, 'type') === 'RESULT' ? (
        <ResultNodeEditor
          config={
            node.config && typeof node.config === 'object' ? (node.config as UnknownRecord) : {}
          }
          outputs={outputs}
          inputs={inputs}
          versionId={versionId}
          nodeKey={key}
          onChange={(nextConfig) => onChange({ config: nextConfig, terminal: true })}
        />
      ) : null}
      {['EXPRESSION', 'SCORE'].includes(display(node, 'type')) ? (
        <ExpressionNodeEditor
          nodeType={display(node, 'type')}
          config={
            node.config && typeof node.config === 'object' ? (node.config as UnknownRecord) : {}
          }
          inputs={inputs}
          onChange={(nextConfig) => onChange({ config: nextConfig })}
        />
      ) : null}
      {display(node, 'type') === 'MANUAL_REVIEW' ? (
        <ManualReviewNodeEditor
          config={
            node.config && typeof node.config === 'object' ? (node.config as UnknownRecord) : {}
          }
          onChange={(nextConfig) => onChange({ config: nextConfig })}
        />
      ) : null}
      {display(node, 'type') === 'DECISION_TABLE' ? (
        <DecisionTableNodeEditor
          config={
            node.config && typeof node.config === 'object' ? (node.config as UnknownRecord) : {}
          }
          inputs={inputs}
          onChange={(nextConfig) => onChange({ config: nextConfig })}
        />
      ) : null}
      {![
        'RESULT',
        'CONDITION',
        'SWITCH',
        'EXPRESSION',
        'SCORE',
        'MANUAL_REVIEW',
        'DECISION_TABLE',
      ].includes(display(node, 'type')) ? (
        <section>
          <h3>Configuración</h3>
          <label className="field">
            <span>Parámetros avanzados</span>
            <textarea
              rows={8}
              className="code-input"
              value={config}
              onChange={(event) => setConfig(event.target.value)}
              onBlur={commitConfig}
            />
          </label>
          {configError ? <small className="field-error">{configError}</small> : null}
        </section>
      ) : null}
      <section>
        <h3>Enrutamiento y salida</h3>
        <label className="field">
          <span>
            <input
              type="checkbox"
              checked={display(node, 'type') === 'RESULT' || Boolean(node.terminal)}
              disabled={display(node, 'type') === 'RESULT'}
              onChange={(event) => onChange({ terminal: event.target.checked })}
            />{' '}
            Nodo terminal
          </span>
        </label>
      </section>
      <section>
        <button type="button" className="button button-danger full-width" onClick={onDelete}>
          <Trash2 size={14} /> Eliminar nodo
        </button>
      </section>
    </aside>
  );
}
