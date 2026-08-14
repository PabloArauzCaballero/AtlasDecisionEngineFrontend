'use client';

import { Plus, Trash2 } from 'lucide-react';
import { ConfirmButton } from '../../components/ConfirmButton';

export interface TrafficRuleDraft {
  /*
   * Identidad estable de la fila, sólo para React. No viaja al motor.
   *
   * Con `key={index}`, quitar una regla intermedia hacía que React reutilizara
   * la fila borrada para la siguiente: los valores se repintaban bien —son
   * campos controlados— pero el foco y la selección de texto se quedaban en la
   * fila equivocada, justo mientras alguien reparte porcentajes de tráfico de
   * producción.
   */
  id: string;
  segmentKey: string;
  trafficPercentage: string;
  priority: string;
}

let nextRuleId = 0;

export function createTrafficRule(index: number): TrafficRuleDraft {
  nextRuleId += 1;
  return {
    id: `rule-${nextRuleId}`,
    segmentKey: '',
    trafficPercentage: '',
    priority: String(index + 1),
  };
}

/*
 * Las dos reglas puras piden sólo los campos que leen, no el borrador entero:
 * el `id` existe para React y obligarlas a exigirlo haría que cada prueba
 * tuviera que inventarse uno para comprobar una suma.
 */
type TrafficRuleValues = Pick<TrafficRuleDraft, 'segmentKey' | 'trafficPercentage'>;

/** Sum of the entered percentages (blank/NaN counts as 0). */
export function trafficTotal(
  rules: readonly Pick<TrafficRuleDraft, 'trafficPercentage'>[],
): number {
  return rules.reduce((sum, rule) => sum + (Number(rule.trafficPercentage) || 0), 0);
}

/** Rules are optional; if present, segments must be named and total exactly 100. */
export function trafficRulesValid(rules: readonly TrafficRuleValues[]): boolean {
  if (!rules.length) return true;
  const named = rules.every(
    (rule) => rule.segmentKey.trim() !== '' && rule.trafficPercentage !== '',
  );
  return named && Math.abs(trafficTotal(rules) - 100) < 0.001;
}

interface TrafficRulesEditorProps {
  rules: TrafficRuleDraft[];
  onChange: (rules: TrafficRuleDraft[]) => void;
}

export function TrafficRulesEditor({ rules, onChange }: TrafficRulesEditorProps) {
  const total = trafficTotal(rules);
  const update = (index: number, patch: Partial<TrafficRuleDraft>) =>
    onChange(rules.map((rule, ruleIndex) => (ruleIndex === index ? { ...rule, ...patch } : rule)));

  return (
    <section>
      <h3>Reglas de tráfico</h3>
      {rules.map((rule, index) => (
        <div key={rule.id} className="traffic-rule">
          <div className="form-row">
            <label className="field">
              <span>Segmento</span>
              <input
                value={rule.segmentKey}
                placeholder="ALL, MX_RETAIL…"
                onChange={(event) => update(index, { segmentKey: event.target.value })}
              />
            </label>
            <label className="field">
              <span>% de tráfico</span>
              <input
                type="number"
                min={0}
                max={100}
                value={rule.trafficPercentage}
                onChange={(event) => update(index, { trafficPercentage: event.target.value })}
              />
            </label>
          </div>
          <div className="inline-actions">
            <label className="field">
              <span>Prioridad</span>
              <input
                type="number"
                min={1}
                value={rule.priority}
                onChange={(event) => update(index, { priority: event.target.value })}
              />
            </label>
            <ConfirmButton
              className="button button-danger"
              label={`Quitar regla ${index + 1}`}
              title={`¿Quitar la regla de tráfico ${index + 1}?`}
              confirmLabel="Quitar la regla"
              description={
                <p>
                  El tráfico que hoy encaja en esta regla pasará a la siguiente por prioridad. Si no
                  queda ninguna que le corresponda, irá al destino por defecto del despliegue.
                </p>
              }
              onConfirm={() => onChange(rules.filter((_, ruleIndex) => ruleIndex !== index))}
            >
              <Trash2 size={14} />
            </ConfirmButton>
          </div>
        </div>
      ))}
      <button
        type="button"
        className="button"
        onClick={() => onChange([...rules, createTrafficRule(rules.length)])}
      >
        <Plus size={14} /> Agregar regla
      </button>
      {rules.length ? (
        <small className={total === 100 ? 'field-hint' : 'field-error'}>
          Total: {total}%{total === 100 ? '' : ' — debe sumar 100'}
        </small>
      ) : null}
    </section>
  );
}
