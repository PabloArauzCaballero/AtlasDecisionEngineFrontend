import { Plus, Trash2 } from 'lucide-react';
import { ConfirmButton } from '../../components/ConfirmButton';
import { asRecord, asRows, display, type UnknownRecord } from '../../utils/records';
import { CodeEditor } from './CodeEditor';
import { ReferenceNodeEditor } from './ReferenceNodeEditor';
import { lintScript } from './script-lint';
import { OptionSelect } from '../../components/OptionSelect';
import { ASSIGNMENT_SOURCE_HELP, RESULT_MODE_HELP } from './graph-node-help';
import { SCRIPT_LANGUAGE_HELP, closedOptions, inputOption } from './graph-editor-help';
import { Field } from '../../components/Field';

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
      <Field
        label="Modo"
        tooltip="Cómo construye este paso el resultado final: asignando valores, con código o llamando a otro algoritmo."
      >
        <OptionSelect
          name="resultMode"
          value={mode}
          onChange={(value) => onChange({ ...config, mode: value })}
          options={closedOptions(
            [
              { value: 'MAPPING', label: 'Visual / sin código' },
              { value: 'SCRIPT', label: 'Código controlado' },
              { value: 'REFERENCE', label: 'Referenciar otro algoritmo' },
            ],
            RESULT_MODE_HELP,
          )}
        />
      </Field>
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
                <Field
                  label="Variable de salida"
                  tooltip="Campo de la respuesta que se rellena con esta asignación."
                >
                  <OptionSelect
                    name="outputCode"
                    value={display(assignment, 'outputCode')}
                    onChange={(value) => updateAssignment(index, { outputCode: value })}
                    options={outputs.map(inputOption)}
                  />
                </Field>
                <Field
                  label="Origen del valor"
                  tooltip="De dónde sale lo que se escribe en la salida: un literal, una variable, una expresión o una plantilla."
                >
                  <OptionSelect
                    name="assignmentSource"
                    value={source}
                    onChange={(value) => updateAssignment(index, { source: value })}
                    options={closedOptions(
                      [
                        { value: 'LITERAL', label: 'Literal' },
                        { value: 'VARIABLE', label: 'Variable de entrada' },
                        { value: 'EXPRESSION', label: 'Expresión visual (JSON AST)' },
                        { value: 'TEMPLATE', label: 'Plantilla' },
                      ],
                      ASSIGNMENT_SOURCE_HELP,
                    )}
                  />
                </Field>
                {source === 'VARIABLE' ? (
                  <Field
                    label="Variable"
                    tooltip="Variable de entrada cuyo valor se copia a la salida."
                  >
                    <OptionSelect
                      name="variablePath"
                      value={display(assignment, 'variablePath')}
                      onChange={(value) => updateAssignment(index, { variablePath: value })}
                      placeholder="Elegir…"
                      options={inputs.map(inputOption)}
                    />
                  </Field>
                ) : null}
                {source === 'LITERAL' || source === 'TEMPLATE' ? (
                  <Field
                    label="Valor"
                    tooltip="Valor fijo que sale en la respuesta. Ej.: APROBADO, 1500 o true."
                  >
                    <textarea
                      rows={2}
                      defaultValue={
                        typeof assignment.value === 'string'
                          ? assignment.value
                          : JSON.stringify(assignment.value)
                      }
                      onBlur={(event) => commitJson(index, 'value', event.target.value)}
                    />
                  </Field>
                ) : null}
                {source === 'EXPRESSION' ? (
                  <Field
                    label="Expresión"
                    tooltip='Árbol JSON que calcula el valor. Ej.: {"op":"mul","left":{"var":"ingreso"},"right":{"value":0.3}}.'
                  >
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
                  </Field>
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
          <Field
            label="Lenguaje"
            tooltip="En qué lenguaje está escrito el código del resultado; el motor lo ejecuta en su entorno aislado."
          >
            <OptionSelect
              name="language"
              value={String(script.language ?? 'JAVASCRIPT')}
              onChange={(value) => onChange({ ...config, script: { ...script, language: value } })}
              options={closedOptions(
                [
                  { value: 'JAVASCRIPT', label: 'JAVASCRIPT' },
                  { value: 'PYTHON', label: 'PYTHON' },
                ],
                SCRIPT_LANGUAGE_HELP,
              )}
            />
          </Field>
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
