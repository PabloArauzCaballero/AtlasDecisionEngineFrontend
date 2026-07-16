import { Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { UnknownRecord } from '../../utils/records';
import { display } from '../../utils/records';
import { ConditionNodeEditor } from './ConditionNodeEditor';
import { ResultNodeEditor } from './ResultNodeEditor';

interface NodePropertiesProps {
  node: UnknownRecord;
  onChange: (patch: UnknownRecord) => void;
  onDelete: () => void;
  outputs?: UnknownRecord[];
  inputs?: UnknownRecord[];
  condition?: UnknownRecord;
  onConditionChange?: (patch: UnknownRecord) => void;
}

export function NodeProperties({
  node,
  onChange,
  onDelete,
  outputs = [],
  inputs = [],
  condition = {},
  onConditionChange,
}: NodePropertiesProps) {
  const key = display(node, 'key');
  const [label, setLabel] = useState('');
  const [config, setConfig] = useState('{}');
  const [configError, setConfigError] = useState<string | null>(null);

  useEffect(() => {
    setLabel(node.label !== undefined ? String(node.label) : '');
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
          <strong>Node Properties</strong>
          <small>Sin selección</small>
        </div>
        <section>
          <p>Selecciona un nodo del canvas para ver y editar sus propiedades.</p>
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
        <strong>Node Properties</strong>
        <small>{key}</small>
      </div>
      <section>
        <h3>General</h3>
        <label className="field">
          <span>Node Key</span>
          <input readOnly value={key} />
        </label>
        <label className="field">
          <span>Label</span>
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            onBlur={() => onChange({ label })}
          />
        </label>
        <label className="field">
          <span>Type</span>
          <input readOnly value={display(node, 'type')} />
        </label>
      </section>
      {display(node, 'type') === 'CONDITION' && onConditionChange ? (
        <ConditionNodeEditor
          key={display(condition, 'code')}
          condition={condition}
          inputs={inputs}
          onChange={onConditionChange}
        />
      ) : null}
      {display(node, 'type') === 'RESULT' ? (
        <ResultNodeEditor
          config={
            node.config && typeof node.config === 'object' ? (node.config as UnknownRecord) : {}
          }
          outputs={outputs}
          inputs={inputs}
          onChange={(nextConfig) => onChange({ config: nextConfig, terminal: true })}
        />
      ) : null}
      {!['RESULT', 'CONDITION'].includes(display(node, 'type')) ? (
        <section>
          <h3>Evaluation Logic</h3>
          <label className="field">
            <span>Configuration</span>
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
        <h3>Routing / Outcomes</h3>
        <label className="field">
          <span>
            <input
              type="checkbox"
              checked={display(node, 'type') === 'RESULT' || Boolean(node.terminal)}
              disabled={display(node, 'type') === 'RESULT'}
              onChange={(event) => onChange({ terminal: event.target.checked })}
            />{' '}
            Terminal
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
