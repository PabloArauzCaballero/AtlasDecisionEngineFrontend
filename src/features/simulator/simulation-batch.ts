import { errorMessage } from '../../api/ApiError';
import type { SimulationResponse } from '../../testing/testing.schemas';
import type { ImportedCase } from './sample-import';

/**
 * Una tanda de simulaciones: un resultado por cada caso generado o importado.
 *
 * Generar cinco casos sintéticos y poder mirar sólo el último no sirve de nada:
 * lo que se quiere saber es en qué se diferencian entre sí —cuál se aprueba,
 * cuál se rechaza y por qué—. Por eso se ejecutan todos y cada uno conserva su
 * resultado, con su etiqueta, para poder recorrerlos.
 *
 * Un caso que falla NO interrumpe la tanda: se guarda su error y se sigue. Si
 * uno mal formado cortara el recorrido, el analista perdería los resultados de
 * los que sí decidieron y no sabría cuál de los cinco fue el que rompió.
 */
export interface BatchEntry {
  label: string;
  input: Record<string, unknown>;
  decision?: SimulationResponse;
  error?: string;
}

/**
 * Los casos a ejecutar. Sin tanda cargada, el payload del formulario.
 *
 * **Con tanda, el caso que el formulario está mostrando se sustituye por lo que
 * hay escrito ahora.** Se devolvía la tanda tal cual, así que todo lo que se
 * tecleara después de generarla o de subir un archivo se descartaba en
 * silencio: el motor recibía los valores viejos y contestaba «falta la variable
 * X» sobre un formulario que la enseñaba rellena. El formulario edita UN caso de
 * la tanda; ignorar esa edición convierte la pantalla en un adorno.
 *
 * Los demás casos viajan intactos: editar uno no debe reescribir los otros.
 */
export function batchCases(
  cases: readonly ImportedCase[],
  current: Record<string, unknown>,
  editing = 0,
): ImportedCase[] {
  if (!cases.length) return [{ label: 'Caso actual', input: current }];
  return cases.map((entry, index) => (index === editing ? { ...entry, input: current } : entry));
}

/**
 * Ejecuta la tanda en serie y devuelve un resultado por caso.
 *
 * En serie y no en paralelo a propósito: son ejecuciones del motor de decisión,
 * y veinte peticiones simultáneas desde el navegador no aceleran nada que el
 * backend no vaya a serializar igual —sólo hacen más difícil saber cuál falló—.
 */
export async function runSimulationBatch(
  cases: readonly ImportedCase[],
  simulate: (input: Record<string, unknown>) => Promise<SimulationResponse>,
): Promise<BatchEntry[]> {
  const entries: BatchEntry[] = [];
  for (const testCase of cases) {
    try {
      entries.push({
        label: testCase.label,
        input: testCase.input,
        decision: await simulate(testCase.input),
      });
    } catch (error) {
      entries.push({ label: testCase.label, input: testCase.input, error: errorMessage(error) });
    }
  }
  return entries;
}

/** Reparto de desenlaces de la tanda, para resumirla de un vistazo. */
export function batchSummary(entries: readonly BatchEntry[]): string {
  if (entries.length <= 1) return '';
  const counts = new Map<string, number>();
  for (const entry of entries) {
    const key = entry.error ? 'con error' : (entry.decision?.outcome ?? 'sin desenlace');
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].map(([outcome, count]) => `${count} ${outcome}`).join(' · ');
}
