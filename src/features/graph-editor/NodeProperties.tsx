import { Pencil } from 'lucide-react';
import { NodeDeleteButton } from './NodeDeleteButton';
import { useEffect, useState } from 'react';
import { InfoHint } from '../../components/InfoHint';
import type { UnknownRecord } from '../../utils/records';
import { asRecord, asRows, display } from '../../utils/records';
import { CalculatedFieldCallsPanel } from './CalculatedFieldCallsPanel';
import { dataFlowHint } from './node-data-flow';
import { NodeTypeTutorial } from './NodeTypeTutorial';
import { ActionNodeEditor } from './ActionNodeEditor';
import { NodeIoPanel } from './NodeIoPanel';
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
  /** Catálogo de condiciones del grafo: resuelve qué variable evalúa un nodo. */
  conditions?: UnknownRecord[];
  /** Catálogo de acciones del grafo: qué ejecuta un nodo de acción. */
  actions?: UnknownRecord[];
  /** Variables declaradas: son las que recibe el nodo de inicio. */
  variables?: UnknownRecord[];
  /** Variables intermedias del grafo: destinos y orígenes de un campo calculado. */
  intermediates?: UnknownRecord[];
  condition?: UnknownRecord;
  branchCount?: number;
  versionId?: string;
  onConditionChange?: (patch: UnknownRecord) => void;
  onCreateCondition?: (variableCode: string) => void;
}

export function NodeProperties({
  node,
  onChange,
  onDelete,
  outputs = [],
  inputs = [],
  conditions = [],
  actions = [],
  variables = [],
  intermediates = [],
  condition = {},
  branchCount = 0,
  versionId = '',
  onConditionChange,
  onCreateCondition,
}: NodePropertiesProps) {
  const key = display(node, 'key');
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [config, setConfig] = useState('{}');
  const [configError, setConfigError] = useState<string | null>(null);
  const [editingDescription, setEditingDescription] = useState(false);

  useEffect(() => {
    setLabel(node.label !== undefined ? String(node.label) : '');
    setDescription(String(asRecord(node.config).description ?? ''));
    setConfig(JSON.stringify(node.config ?? {}, null, 2));
    setConfigError(null);
    setEditingDescription(false);
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
      {/* La guía del tipo va lo primero: explica de dónde sale cada pieza que los
          campos de abajo piden, que es justo lo que no era evidente. */}
      <NodeTypeTutorial nodeType={display(node, 'type')} />
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
        {/* Con descripción escrita, un cuadro de texto vacío pidiendo "añade una
            descripción" contradice lo que el usuario ya hizo: se muestra lo
            escrito y se edita con el lápiz. */}
        {description.trim() && !editingDescription ? (
          <div className="node-description-card">
            <div>
              <span>Descripción del paso</span>
              <p>{description}</p>
            </div>
            <button
              type="button"
              className="icon-button"
              aria-label="Editar la descripción del paso"
              title="Editar la descripción"
              onClick={() => setEditingDescription(true)}
            >
              <Pencil size={14} />
            </button>
          </div>
        ) : (
          <label className="field">
            <span>
              Descripción del paso
              <InfoHint text="Explica en palabras simples QUÉ hace este paso y POR QUÉ, para que cualquier persona lo entienda sin ser técnica." />
            </span>
            <textarea
              rows={3}
              autoFocus={editingDescription}
              value={description}
              placeholder="Ej.: Comprueba que el cliente pasó KYC y dio su consentimiento antes de evaluar el riesgo."
              onChange={(event) => setDescription(event.target.value)}
              onBlur={() => {
                setEditingDescription(false);
                onChange({ config: { ...asRecord(node.config), description } });
              }}
            />
          </label>
        )}
        <label className="field">
          <span>Tipo</span>
          <input readOnly value={display(node, 'type')} />
        </label>
        <p className="node-io-hint">{dataFlowHint(display(node, 'type'))}</p>
      </section>
      {/* Vale para todos los tipos: antes había que leer el JSON de
          configuración para saber qué hacía el paso y con qué datos. */}
      <NodeIoPanel node={node} context={{ conditions, actions, variables }} />
      {display(node, 'type') === 'CONDITION' && onConditionChange ? (
        <ConditionNodeEditor
          key={display(condition, 'code')}
          condition={condition}
          inputs={inputs}
          onChange={onConditionChange}
          onCreateCondition={onCreateCondition}
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
      {display(node, 'type') === 'ACTION' ? (
        <ActionNodeEditor
          node={node}
          config={asRecord(node.config)}
          actions={actions}
          onChange={onChange}
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
        'ACTION',
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
      <CalculatedFieldCallsPanel
        calls={asRows(node.calculatedFieldCalls)}
        inputs={inputs}
        intermediates={intermediates}
        outputs={outputs}
        onChange={(calculatedFieldCalls) => onChange({ calculatedFieldCalls })}
      />
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
        <NodeDeleteButton label={display(node, 'label', 'key')} onDelete={onDelete} />
      </section>
    </aside>
  );
}
