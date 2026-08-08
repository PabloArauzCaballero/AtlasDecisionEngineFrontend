'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchRuns, fetchWorkerMetrics, type WorkerCode } from './workers.api';

/**
 * Ventana que se le pide al motor, en horas.
 *
 * Una semana: es el periodo en el que un operador todavía reconoce lo que pasó
 * y a la vez hay suficientes ejecuciones para que un percentil signifique algo.
 */
export const WORKER_WINDOW_HOURS = 168;

/** Cuántas ejecuciones sostienen el gráfico de barras. */
export const WORKER_CHART_RUNS = 50;

/**
 * Salud del worker, calculada por el motor.
 *
 * Se refresca sola cada 15 s **mientras la pestaña está a la vista**. Es un
 * panel de operación —una cola que no avanza en pantalla no informa de nada—,
 * pero el sondeo se detiene con la ventana en segundo plano en lugar de seguir
 * preguntando por algo que nadie está mirando.
 */
export function useWorkerMetrics(worker: WorkerCode, enabled = true) {
  return useQuery({
    queryKey: ['worker-metrics', worker, WORKER_WINDOW_HOURS],
    enabled,
    queryFn: ({ signal }) => fetchWorkerMetrics(worker, WORKER_WINDOW_HOURS, signal),
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    staleTime: 5_000,
  });
}

/**
 * Las últimas ejecuciones, sólo para el gráfico de barras.
 *
 * Es lo único que el agregado no puede dar: un percentil no se desagrega en las
 * muestras que lo produjeron. Todo lo demás del panel viene ya calculado.
 */
export function useWorkerRuns(worker: WorkerCode, enabled = true) {
  return useQuery({
    queryKey: ['worker-runs', worker],
    enabled,
    queryFn: ({ signal }) => fetchRuns(worker, { pageSize: WORKER_CHART_RUNS, signal }),
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    staleTime: 5_000,
  });
}
