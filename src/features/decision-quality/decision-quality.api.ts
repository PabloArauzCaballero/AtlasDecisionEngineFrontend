'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../api/http-client';

/*
 * Las rutas se escriben ENTERAS, nunca componiendo el nombre de la operación.
 *
 * El inventario de superficie (`scripts/engine-surface.mjs`) lee una ruta interpolada como un
 * comodín de un segmento, y ese comodín daría por consumidas también las operaciones vecinas
 * que el portal NO llama. La lista de deuda dejaría de avisar justo donde importa.
 */

export interface CoverageReport {
  from: string;
  to: string;
  /**
   * Qué parte de la población medida es siembra de DEMOSTRACIÓN.
   *
   * Opcional porque un motor anterior a este campo no lo manda, y el panel tiene que seguir
   * pintándose contra él en lugar de romperse: quien despliegue el portal antes que el motor
   * vería la pantalla entera caída por un aviso que es accesorio.
   */
  seeded?: {
    executions: number;
    share: number | null;
  };
  subject: {
    executions: number;
    notApplicable: number;
    eligible: number;
    withSubject: number;
    missing: number;
    coverageRatio: number | null;
  };
  outcome: {
    dueWindows: number;
    observedWindows: number;
    overdueWindows: number;
    inferredWindows: number;
    coverageRatio: number | null;
  };
  daily: Array<{ day: string; executions: number; withSubject: number }>;
}

export interface PendingWindow {
  windowId: string;
  executionId: string;
  windowDays: number;
  dueAt: string;
  decidedAt: string;
  overdueDays: number;
  externalReference: string | null;
  artifactCode: string;
}

export interface VintageCell {
  cohort: string;
  windowDays: number;
  facilities: number;
  observed: number;
  bad: number;
  inferred: number;
  badRate: number | null;
  badAmount: number;
}

export interface OutcomeRowResult {
  externalReference: string;
  windowDays?: number;
  accepted: boolean;
  code?: string;
  message?: string;
}

export interface OutcomeBatchResult {
  accepted: number;
  rejected: number;
  dryRun: boolean;
  rows: OutcomeRowResult[];
}

/** Estado del circuito. Se refresca solo: es un indicador de salud, no un informe. */
export function useCoverageReport(days: number) {
  return useQuery({
    queryKey: ['decision-coverage', days],
    queryFn: ({ signal }) => {
      const to = new Date();
      const from = new Date(to.getTime() - days * 86_400_000);
      const query = `?from=${from.toISOString()}&to=${to.toISOString()}`;
      return apiRequest<CoverageReport>(`/v1/model-monitoring/coverage${query}`, { signal });
    },
    refetchInterval: 60_000,
  });
}

export function usePendingWindows(limit: number) {
  return useQuery({
    queryKey: ['outcome-pending', limit],
    queryFn: ({ signal }) =>
      apiRequest<{ limit: number; items: PendingWindow[] }>(`/v1/outcomes/pending?limit=${limit}`, {
        signal,
      }),
  });
}

export function useVintageMatrix(artifactVersionId: string) {
  return useQuery({
    queryKey: ['outcome-vintage', artifactVersionId],
    queryFn: ({ signal }) => {
      const query = artifactVersionId
        ? `?artifactVersionId=${encodeURIComponent(artifactVersionId)}`
        : '';
      return apiRequest<{ from: string; to: string; cells: VintageCell[] }>(
        `/v1/outcomes/vintage${query}`,
        { signal },
      );
    },
  });
}

export interface OutcomeDraft {
  externalReference: string;
  windowDays: number;
  label: string;
  source: string;
  amount?: number;
  inferenceMethod?: string;
}

/**
 * Carga de desenlaces en lote.
 *
 * `dryRun` no es una comodidad de la interfaz: es la forma de que el operador VEA las filas que
 * se rechazarían antes de escribir nada. Sin ella, descubrir en la fila 4000 que una referencia
 * no existía —con 3999 ya escritas sobre evidencia regulatoria— obliga a un borrado manual
 * sobre la tabla que justamente no se debe borrar a mano.
 */
export function useOutcomeBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { outcomes: OutcomeDraft[]; dryRun: boolean }) =>
      apiRequest<OutcomeBatchResult>('/v1/outcomes/batch', { method: 'POST', body: input }),
    onSuccess: async (result) => {
      if (result.dryRun) return;
      await queryClient.invalidateQueries({ queryKey: ['outcome-pending'] });
      await queryClient.invalidateQueries({ queryKey: ['decision-coverage'] });
      await queryClient.invalidateQueries({ queryKey: ['outcome-vintage'] });
    },
  });
}

export interface FacilityDraft {
  externalReference: string;
  originationExecutionId: string;
  principalAmount: number;
  currencyCode: string;
  termMonths: number;
  annualRate: number;
  disbursedAt?: string;
}

export function useFacilityRegistration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (facilities: FacilityDraft[]) =>
      apiRequest<{ registered: number; rejected: number; rows: OutcomeRowResult[] }>(
        '/v1/outcomes/facilities',
        { method: 'POST', body: { facilities } },
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['decision-coverage'] }),
  });
}

/**
 * Alta puntual de UN desenlace, por identificador de ejecución.
 *
 * Convive con la carga en lote y no la duplica: ésta es para el fraude confirmado y la
 * corrección, que llegan de una en una y desde una persona, no desde la conciliación nocturna.
 */
export function useManualOutcome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      executionId: string;
      windowDays: number;
      label: string;
      source: string;
      notes?: string;
    }) =>
      apiRequest<{ recorded: number }>('/v1/model-monitoring/outcomes', {
        method: 'POST',
        body: { observations: [input] },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['outcome-pending'] });
      await queryClient.invalidateQueries({ queryKey: ['decision-coverage'] });
    },
  });
}

/** Fracción a porcentaje. `null` es «no se pudo medir», que no es 0 %. */
export function asPercent(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(1)} %`;
}

/**
 * Tono de una cobertura.
 *
 * Sin medición no hay tono: pintar de rojo un sistema que simplemente no decidió esta semana
 * es una alarma falsa, y las alarmas falsas se desactivan.
 */
export function coverageTone(ratio: number | null): 'success' | 'warning' | 'danger' | 'default' {
  if (ratio === null) return 'default';
  if (ratio >= 0.98) return 'success';
  return ratio >= 0.9 ? 'warning' : 'danger';
}
