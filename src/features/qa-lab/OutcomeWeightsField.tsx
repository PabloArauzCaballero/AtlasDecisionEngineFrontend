'use client';

import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../api/http-client';
import { asRecord, asRows, display, type UnknownRecord } from '../../utils/records';

interface Props {
  /** Versión compilada cuyos desenlaces se reparten. Sin ella no hay nada que listar. */
  versionId: string;
  /** Pesos relativos por `nodeKey`; vacío = sin reparto. */
  weights: Record<string, number>;
  onChange: (weights: Record<string, number>) => void;
}

/**
 * Reparte la porción VÁLIDA de la corrida entre los desenlaces del algoritmo.
 *
 * Los desenlaces se piden al motor (`/v1/qa-lab/versions/:id/outcomes`) en vez de
 * escribirse a mano: la clave que valida el servidor es el `nodeKey` del grafo, y
 * teclearlo a ciegas sólo servía para descubrir el error al lanzar la corrida.
 *
 * Sin pesos, los válidos se generan a ciegas y la mezcla real la decide el contrato: con
 * un score de 300 a 900 y un corte en 750, cuatro de cada cinco casos «válidos» caen en la
 * misma rama y las demás se prueban de milagro.
 */
export function OutcomeWeightsField({ versionId, weights, onChange }: Props) {
  const outcomes = useQuery({
    queryKey: ['qa-outcomes', versionId],
    queryFn: ({ signal }) =>
      apiRequest<UnknownRecord>(`/v1/qa-lab/versions/${encodeURIComponent(versionId)}/outcomes`, {
        signal,
      }),
    enabled: Boolean(versionId),
  });

  const items = asRows(asRecord(outcomes.data).items);
  if (!versionId || !items.length) return null;

  const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);

  const patch = (nodeKey: string, raw: string) => {
    const next = { ...weights };
    // Vacío ≠ cero: vacío es «no repartas por aquí», cero es «ninguno de esta rama».
    if (raw.trim() === '') delete next[nodeKey];
    else next[nodeKey] = Math.max(0, Number(raw) || 0);
    onChange(next);
  };

  return (
    <div className="outcome-weights">
      <span className="outcome-weights-head">Reparto por resultado (opcional)</span>
      <div className="constraint-grid">
        {items.map((item) => {
          const nodeKey = display(item, 'nodeKey');
          return (
            <label className="constraint-field" key={nodeKey}>
              <span>{display(item, 'label')}</span>
              <input
                type="number"
                min={0}
                max={1000}
                placeholder="sin peso"
                value={weights[nodeKey] ?? ''}
                onChange={(event) => patch(nodeKey, event.target.value)}
              />
            </label>
          );
        })}
      </div>
      <small className="field-hint">
        {total > 0
          ? `Los pesos son relativos: no hace falta que sumen 100 (ahora suman ${total}). Reparten los casos VÁLIDOS; frontera e inválidos siguen saliendo de la mezcla.`
          : 'Sin pesos, los casos válidos caen donde los lleve el contrato, que suele ser siempre la misma rama.'}
      </small>
    </div>
  );
}
