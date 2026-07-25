import { InfoHint } from '../../components/InfoHint';
import { asRecord, display, type UnknownRecord } from '../../utils/records';

interface ConditionNodeEditorProps {
  condition: UnknownRecord;
  inputs: UnknownRecord[];
  onChange: (patch: UnknownRecord) => void;
}

const operators = [
  ['eq', 'Igual a'],
  ['neq', 'Distinto de'],
  ['gt', 'Mayor que'],
  ['gte', 'Mayor o igual'],
  ['lt', 'Menor que'],
  ['lte', 'Menor o igual'],
  ['in', 'Incluido en lista'],
  ['contains', 'Contiene'],
] as const;

export function ConditionNodeEditor({ condition, inputs, onChange }: ConditionNodeEditorProps) {
  const expression = asRecord(condition.expression);
  const code = display(condition, 'code');

  function updateExpression(patch: UnknownRecord) {
    onChange({ expression: { ...expression, ...patch } });
  }

  function updateValue(raw: string) {
    try {
      updateExpression({ value: JSON.parse(raw) });
    } catch {
      updateExpression({ value: raw });
    }
  }

  if (!condition.code) {
    return (
      <section className="condition-node-editor">
        <h3>Condición visual</h3>
        <p className="field-hint">
          Este nodo decide el camino según las condiciones de sus{' '}
          <strong>conexiones de salida</strong> (cada flecha lleva su regla). Usa la{' '}
          <strong>“Descripción del paso”</strong> de arriba para explicar en palabras qué evalúa, y
          edita cada regla haciendo clic en su conexión.
        </p>
      </section>
    );
  }

  return (
    <section className="condition-node-editor">
      <h3>Condición visual</h3>
      <label className="field">
        <span>Código</span>
        <input readOnly value={code} />
      </label>
      <label className="field">
        <span>Nombre</span>
        <input
          defaultValue={display(condition, 'name')}
          onBlur={(event) => onChange({ name: event.target.value })}
        />
      </label>
      <label className="field">
        <span>
          Variable de entrada
          <InfoHint text="El dato que se compara (p. ej. score_buro). Debe estar declarado como entrada del algoritmo." />
        </span>
        <select
          value={String(expression.variable ?? '')}
          onChange={(event) => updateExpression({ variable: event.target.value })}
        >
          <option value="">Elegir variable…</option>
          {inputs.map((input) => (
            <option key={display(input, 'code')} value={display(input, 'code')}>
              {display(input, 'code')} · {display(input, 'dataType')}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>
          Operador
          <InfoHint text="Cómo se compara: igual, mayor que, incluido en lista… Define cuándo la condición se cumple (verdadero)." />
        </span>
        <select
          value={String(expression.operator ?? 'gte')}
          onChange={(event) => updateExpression({ operator: event.target.value })}
        >
          {operators.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>
          Valor de comparación
          <InfoHint text="Contra qué se compara la variable (p. ej. 650). Para el operador «incluido en lista», escribe los valores en formato JSON de lista." />
        </span>
        <textarea
          key={`${code}-${JSON.stringify(expression.value)}`}
          rows={3}
          defaultValue={
            typeof expression.value === 'string'
              ? expression.value
              : JSON.stringify(expression.value ?? null)
          }
          onBlur={(event) => updateValue(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Severidad</span>
        <select
          value={display(condition, 'severity')}
          onChange={(event) => onChange({ severity: event.target.value })}
        >
          <option value="BLOCKING">Blocking</option>
          <option value="WARNING">Warning</option>
          <option value="INFO">Info</option>
        </select>
      </label>
    </section>
  );
}
