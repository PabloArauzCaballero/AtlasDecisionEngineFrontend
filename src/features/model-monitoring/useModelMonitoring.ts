'use client';

import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '../../api/http-client';
import type { UnknownRecord } from '../../utils/records';

/**
 * Los tres análisis del monitoreo continuo del modelo desplegado.
 *
 * Son `POST` y no `GET` —y por eso mutaciones y no consultas— porque llevan ventanas y filtros en
 * el cuerpo, y porque ninguno es cacheable: su respuesta cambia con cada desenlace que el libro de
 * préstamos entrega. Pedirlos como consultas con clave dejaría en pantalla un número viejo justo
 * después de cargar la cosecha que lo cambia.
 */
export interface MonitoringWindow {
  artifactVersionId: string;
  from?: string;
  to?: string;
}

/*
 * Las tres rutas se escriben ENTERAS y no se componen interpolando el nombre del análisis.
 *
 * Componerla es más corto y miente. El inventario de superficie (`scripts/engine-surface.mjs`) lee
 * una ruta interpolada como un comodín, y ese comodín cubriría las CINCO operaciones del grupo —
 * incluidas las dos de escritura, que el portal no llama y no debe llamar: los desenlaces los
 * carga el libro de préstamos y los atributos de sesgo, quien audita. Con el comodín, la lista de
 * deuda daría esas dos por saldadas y dejaría de avisar de que nadie las consume.
 *
 * (El comodín se dispara por el TEXTO, así que este comentario tampoco puede escribir la ruta
 * interpolada como ejemplo: lo probé, y anulaba el gate desde aquí dentro.)
 */
export function usePerformanceReport() {
  return useMutation({
    mutationFn: (window: MonitoringWindow) =>
      apiRequest<UnknownRecord>('/v1/model-monitoring/performance', {
        method: 'POST',
        body: { ...window },
      }),
  });
}

export function useStabilityReport() {
  return useMutation({
    mutationFn: (
      input: MonitoringWindow & {
        variableCode: string;
        referenceFrom: string;
        referenceTo: string;
      },
    ) =>
      apiRequest<UnknownRecord>('/v1/model-monitoring/stability', {
        method: 'POST',
        body: { ...input },
      }),
  });
}

export function useAdverseImpactReport() {
  return useMutation({
    mutationFn: (input: MonitoringWindow & { attribute: string }) =>
      apiRequest<UnknownRecord>('/v1/model-monitoring/adverse-impact', {
        method: 'POST',
        body: { ...input },
      }),
  });
}

/** Fracción a porcentaje legible. `null` es «no se pudo medir», y no es lo mismo que 0 %. */
export function asPercent(value: unknown): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(1)} %`;
}

/** Tono del veredicto de estabilidad, con los cortes de uso corriente que publica el motor. */
export function stabilityTone(verdict: string): 'success' | 'warning' | 'danger' {
  if (verdict === 'STABLE') return 'success';
  return verdict === 'SHIFTED' ? 'warning' : 'danger';
}
