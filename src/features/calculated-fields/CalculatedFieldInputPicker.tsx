'use client';

import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { apiRequest } from '../../api/http-client';
import { parseConstraints, type VariableConstraints } from '../../contracts/constraints';
import { normalizeDataType } from '../../contracts/data-types';
import { asRecord, asRows, display, type UnknownRecord } from '../../utils/records';
import type { CalculatedFieldInput } from './calculated-field.types';

interface Props {
  taken: string[];
  onAdd: (input: CalculatedFieldInput) => void;
  /** Las restricciones llegan después, en una segunda petición; ver `addFromCatalog`. */
  onConstraints: (id: string, constraints: VariableConstraints) => void;
}

const ORIGINS = [
  ['CATALOG', 'Del catálogo'],
  ['CUSTOM', 'Entrada propia'],
] as const;

/**
 * De dónde sale una entrada: del catálogo de variables, o declarada a mano.
 *
 * Lo normal es lo primero. Escribir el identificador a mano obligaba a acertar de memoria
 * el código exacto de la variable —`monthly_income`, no `ingreso_mensual`— y a repetir su
 * tipo y sus restricciones; un dedazo no daba error, daba una entrada que ningún artefacto
 * sabría rellenar. Elegirla del catálogo trae las cuatro cosas ya puestas.
 *
 * La entrada propia SIGUE existiendo porque no todo parámetro es una variable del
 * catálogo: un umbral, un factor de conversión o un divisor son argumentos del cálculo y
 * no datos del solicitante, y darlos de alta en el catálogo para poder usarlos aquí lo
 * llenaría de ruido.
 */
export function CalculatedFieldInputPicker({ taken, onAdd, onConstraints }: Props) {
  const [origin, setOrigin] = useState<'CATALOG' | 'CUSTOM'>('CATALOG');
  const [chosen, setChosen] = useState('');
  const [draftId, setDraftId] = useState('');

  const catalog = useQuery({
    queryKey: ['variable-picker'],
    queryFn: ({ signal }) => apiRequest<UnknownRecord[]>('/v1/views/pickers/variables', { signal }),
  });
  const rows = asRows(catalog.data).filter((row) => !taken.includes(display(row, 'variableCode')));

  /**
   * Las restricciones no viajan en el picker: viven en el detalle de la variable. Se
   * piden al elegirla y se copian a la entrada, porque son lo que después decide qué es
   * un valor «de frontera» o «inválido» al generar datos de prueba. Sin ellas, el
   * generador sólo sabría inventar números del tipo correcto.
   */
  async function addFromCatalog(definitionId: string) {
    const row = rows.find((item) => display(item, 'definitionId') === definitionId);
    if (!row) return;
    const code = display(row, 'variableCode');
    setChosen('');
    onAdd({
      id: code,
      name: display(row, 'canonicalName') || code,
      description: `Variable ${code} del catálogo`,
      dataType: normalizeDataType(display(row, 'dataType')),
      required: !row.nullable,
    });
    try {
      const detail = await apiRequest<UnknownRecord>(
        `/v1/variables/${encodeURIComponent(definitionId)}`,
      );
      const versions = asRows(asRecord(detail).versions);
      const latest = versions[versions.length - 1] ?? {};
      const constraints = parseConstraints(latest.constraintsJson ?? latest.validationSchemaJson);
      if (Object.keys(constraints).length) onConstraints(code, constraints);
    } catch {
      // La entrada ya está añadida con su tipo: quedarse sin restricciones es una
      // pérdida de comodidad, no un fallo que merezca deshacer lo elegido.
    }
  }

  function addCustom() {
    const id = draftId.trim();
    if (!id || taken.includes(id)) return;
    onAdd({ id, name: id, description: '', dataType: 'DECIMAL', required: true });
    setDraftId('');
  }

  return (
    <div className="calculated-input-picker">
      {/* Mismo control que la modalidad de implementación: dos opciones excluyentes son
          un grupo de radios, no dos botones que sólo PARECEN estar pulsados. */}
      <div className="implementation-choices">
        {ORIGINS.map(([option, label]) => (
          <label key={option} className={origin === option ? 'is-active' : ''}>
            <input
              type="radio"
              name="calculated-input-origin"
              value={option}
              checked={origin === option}
              onChange={() => setOrigin(option)}
            />
            {label}
          </label>
        ))}
      </div>

      {origin === 'CATALOG' ? (
        <div className="output-contract-controls">
          <label className="constraint-field">
            <span>Variable del catálogo</span>
            <select
              aria-label="Variable del catálogo"
              value={chosen}
              disabled={catalog.isPending}
              onChange={(event) => {
                setChosen(event.target.value);
                if (event.target.value) void addFromCatalog(event.target.value);
              }}
            >
              <option value="">
                {catalog.isPending ? 'Cargando el catálogo…' : '— elegir variable —'}
              </option>
              {rows.map((row) => (
                <option key={display(row, 'definitionId')} value={display(row, 'definitionId')}>
                  {display(row, 'variableCode')} · {display(row, 'canonicalName')} (
                  {display(row, 'dataType')})
                </option>
              ))}
            </select>
          </label>
          <small className="field-hint">
            Trae ya puestos el identificador, el nombre, el tipo y las restricciones que el catálogo
            declara.
          </small>
        </div>
      ) : (
        <div className="output-contract-controls">
          <label className="constraint-field">
            <span>Identificador de la entrada</span>
            <input
              aria-label="Identificador de la nueva entrada"
              placeholder="factor_conversion"
              value={draftId}
              onChange={(event) => setDraftId(event.target.value)}
            />
          </label>
          <button
            className="button button-primary"
            type="button"
            disabled={!draftId.trim()}
            onClick={addCustom}
          >
            <Plus size={14} aria-hidden /> Añadir entrada
          </button>
          <small className="field-hint">
            Para parámetros del cálculo que no son variables del catálogo: un umbral, un factor, un
            divisor.
          </small>
        </div>
      )}
    </div>
  );
}
