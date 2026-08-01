import { Plus, Trash2 } from 'lucide-react';
import { ConfirmButton } from '../../components/ConfirmButton';
import { asRecord, asRows, display, type UnknownRecord } from '../../utils/records';
import { CodeEditor } from './CodeEditor';
import { ReferenceNodeEditor } from './ReferenceNodeEditor';
import { lintScript } from './script-lint';

interface Props {
  config: UnknownRecord;
  outputs: UnknownRecord[];
  inputs: UnknownRecord[];
  onChange: (config: UnknownRecord) => void;
  versionId?: string;
  nodeKey?: string;
}

export function ResultNodeEditor({
  config,
  outputs,
  inputs,
  onChange,
  versionId = '',
  nodeKey = '',
}: Props) {
  const mode = String(config.mode ?? 'MAPPING');
  const assignments = asRows(config.assignments);
  const script = asRecord(config.script);
  const scriptIssues =
    mode === 'SCRIPT'
      ? lintScript(
          String(script.source ?? ''),
          String(script.language ?? 'JAVASCRIPT'),
          outputs.map((output) => display(output, 'code')),
        )
      : [];

  function updateAssignment(index: number, patch: UnknownRecord) {
    onChange({
      ...config,
      assignments: assignments.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    });
  }

  function addAssignment() {
    const used = new Set(assignments.map((item) => display(item, 'outputCode')));
    const available = outputs.find((item) => !used.has(display(item, 'code'))) ?? outputs[0];
    if (!available) return;
    onChange({
      ...config,
      mode: 'MAPPING',
      assignments: [
        ...assignments,
        { outputCode: display(available, 'code'), source: 'LITERAL', value: null },
      ],
    });
  }

  function commitJson(index: number, field: string, raw: string) {
    try {
      updateAssignment(index, { [field]: JSON.parse(raw) });
    } catch {
      updateAssignment(index, { [field]: raw });
    }
  }

  return (
    <section className="result-node-editor">
      <h3>Resultado configurable</h3>
      <label className="field">
        <span>Modo</span>
        <select
          value={mode}
          onChange={(event) => onChange({ ...config, mode: event.target.value })}
        >
          <option value="MAPPING">Visual / sin código</option>
          <option value="SCRIPT">Código controlado</option>
          <option value="REFERENCE">Referenciar otro algoritmo</option>
        </select>
      </label>
      {!outputs.length ? (
        <p className="field-hint">
          Añade primero una variable en el contrato global de resultados.
        </p>
      ) : null}
      {mode === 'MAPPING' ? (
        <>
          {assignments.map((assignment, index) => {
            const source = String(assignment.source ?? 'LITERAL');
            return (
              <div className="result-assignment" key={display(assignment, 'outputCode')}>
                <label className="field">
                  <span>Variable de salida</span>
                  <select
                    value={display(assignment, 'outputCode')}
                    onChange={(event) =>
                      updateAssignment(index, { outputCode: event.target.value })
                    }
                  >
                    {outputs.map((output) => (
                      <option key={display(output, 'code')} value={display(output, 'code')}>
                        {display(output, 'code')} · {display(output, 'dataType')}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Origen del valor</span>
                  <select
                    value={source}
                    onChange={(event) => updateAssignment(index, { source: event.target.value })}
                  >
                    <option value="LITERAL">Literal</option>
                    <option value="VARIABLE">Variable de entrada</option>
                    <option value="EXPRESSION">Expresión visual (JSON AST)</option>
                    <option value="TEMPLATE">Plantilla</option>
                  </select>
                </label>
                {source === 'VARIABLE' ? (
                  <label className="field">
                    <span>Variable</span>
                    <select
                      value={display(assignment, 'variablePath')}
                      onChange={(event) =>
                        updateAssignment(index, { variablePath: event.target.value })
                      }
                    >
                      <option value="">Elegir…</option>
                      {inputs.map((input) => (
                        <option key={display(input, 'code')} value={display(input, 'code')}>
                          {display(input, 'code')}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {source === 'LITERAL' || source === 'TEMPLATE' ? (
                  <label className="field">
                    <span>Valor</span>
                    <textarea
                      rows={2}
                      defaultValue={
                        typeof assignment.value === 'string'
                          ? assignment.value
                          : JSON.stringify(assignment.value)
                      }
                      onBlur={(event) => commitJson(index, 'value', event.target.value)}
                    />
                  </label>
                ) : null}
                {source === 'EXPRESSION' ? (
                  <label className="field">
                    <span>Expresión</span>
                    <textarea
                      className="code-input"
                      rows={5}
                      defaultValue={JSON.stringify(
                        assignment.expression ?? {
                          var: inputs[0] ? display(inputs[0], 'code') : '',
                        },
                        null,
                        2,
                      )}
                      onBlur={(event) => commitJson(index, 'expression', event.target.value)}
                    />
                  </label>
                ) : null}
                <ConfirmButton
                  className="button button-danger full-width"
                  title="¿Quitar esta asignación del resultado?"
                  confirmLabel="Quitar la asignación"
                  description={
                    <p>
                      Este paso dejará de escribir esa salida. Si nadie más la escribe, la decisión
                      devolverá el campo vacío.
                    </p>
                  }
                  onConfirm={() =>
                    onChange({
                      ...config,
                      assignments: assignments.filter((_, itemIndex) => itemIndex !== index),
                    })
                  }
                >
                  <Trash2 size={13} /> Quitar asignación
                </ConfirmButton>
              </div>
            );
          })}
          <button
            className="button full-width"
            type="button"
            disabled={!outputs.length}
            onClick={addAssignment}
          >
            <Plus size={14} /> Asignar resultado
          </button>
        </>
      ) : mode === 'REFERENCE' ? (
        <ReferenceNodeEditor
          versionId={versionId}
          nodeKey={nodeKey}
          inputs={inputs}
          outputs={outputs}
          onOutputAssignments={(assignments) =>
            onChange({ ...config, mode: 'REFERENCE', outputAssignments: assignments })
          }
        />
      ) : (
        <>
          <div className="script-warning">
            Experimental: se ejecuta con límites estrictos y requiere habilitación explícita del
            backend.
          </div>
          <label className="field">
            <span>Lenguaje</span>
            <select
              value={String(script.language ?? 'JAVASCRIPT')}
              onChange={(event) =>
                onChange({ ...config, script: { ...script, language: event.target.value } })
              }
            >
              <option>JAVASCRIPT</option>
              <option>PYTHON</option>
            </select>
          </label>
          <CodeEditor
            language={String(script.language ?? 'JAVASCRIPT')}
            inputs={inputs}
            outputs={outputs}
            value={String(
              script.source ??
                (script.language === 'PYTHON'
                  ? 'result = {"scoring": variables["score"]}'
                  : 'return { scoring: variables.score };'),
            )}
            onChange={(source) =>
              onChange({
                ...config,
                script: { ...script, language: script.language ?? 'JAVASCRIPT', source },
              })
            }
          />
          {scriptIssues.length ? (
            <ul className="script-static-issues">
              {scriptIssues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          ) : null}
          <small className="field-hint">
            JS debe retornar un objeto. Python debe asignarlo a <code>result</code>. Sólo se aceptan
            claves declaradas arriba.
          </small>
        </>
      )}
    </section>
  );
}
