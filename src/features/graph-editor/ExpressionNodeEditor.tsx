import { InfoHint } from '../../components/InfoHint';
import { asRecord, type UnknownRecord } from '../../utils/records';
import { CodeEditor } from './CodeEditor';
import { lintScript } from './script-lint';

interface Props {
  nodeType: string;
  config: UnknownRecord;
  inputs: UnknownRecord[];
  onChange: (config: UnknownRecord) => void;
}

const DEFAULT_SOURCE: Record<string, string> = {
  JAVASCRIPT: 'return variables.monthlyIncome * 0.35;',
  PYTHON: 'result = variables["monthlyIncome"] * 0.35',
};

/**
 * Code editor for EXPRESSION and SCORE nodes. The script computes one value
 * from the declared inputs and the engine stores it under `targetVariable`,
 * using the same `config.script` contract and sandbox rules as RESULT nodes.
 */
export function ExpressionNodeEditor({ nodeType, config, inputs, onChange }: Props) {
  const script = asRecord(config.script);
  const language = String(script.language ?? 'JAVASCRIPT');
  const source = String(script.source ?? DEFAULT_SOURCE[language] ?? '');
  const targetVariable = String(config.targetVariable ?? '');
  // No output-contract references are required here: the engine assigns the
  // returned value to targetVariable, so only the sandbox and shape rules run.
  const issues = lintScript(source, language, []);

  return (
    <section className="result-node-editor">
      <h3>{nodeType === 'SCORE' ? 'Cálculo de score' : 'Expresión calculada'}</h3>
      <label className="field">
        <span>
          Variable destino
          <InfoHint text="Dónde se guarda el resultado del cálculo. Puede ser una salida o una variable intermedia que otros nodos usen." />
        </span>
        <input
          value={targetVariable}
          placeholder={nodeType === 'SCORE' ? 'score_riesgo' : 'valor_calculado'}
          onChange={(event) => onChange({ ...config, targetVariable: event.target.value.trim() })}
        />
      </label>
      {!targetVariable ? (
        <p className="field-hint">
          Define el nombre de la variable donde el motor guardará el valor calculado.
        </p>
      ) : null}
      <label className="field">
        <span>
          Lenguaje
          <InfoHint text="En qué se escribe el cálculo: una expresión visual, o código (JavaScript/Python) para casos avanzados." />
        </span>
        <select
          value={language}
          onChange={(event) =>
            onChange({ ...config, script: { ...script, language: event.target.value } })
          }
        >
          <option>JAVASCRIPT</option>
          <option>PYTHON</option>
        </select>
      </label>
      <CodeEditor
        language={language}
        inputs={inputs}
        outputs={[]}
        value={source}
        onChange={(nextSource) =>
          onChange({ ...config, script: { ...script, language, source: nextSource } })
        }
      />
      {issues.length ? (
        <ul className="script-static-issues">
          {issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      ) : null}
      <small className="field-hint">
        JS debe retornar el valor calculado. Python debe asignarlo a <code>result</code>. Los chips
        insertan la referencia correcta de cada variable de entrada.
      </small>
    </section>
  );
}
