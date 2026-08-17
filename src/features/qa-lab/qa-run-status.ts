/**
 * El estado de una corrida de QA Lab, en español y en un solo sitio.
 *
 * `FAILED` es la corrida que se CORTÓ, no la que encontró fallos: una corrida que termina con
 * mil contraejemplos está «Terminada», y traducirlo por «Fallida» haría leer un hallazgo como
 * una avería. Lo usan el historial del QA Lab y el carril sintético del monitoreo del modelo,
 * y por eso vive aquí: dos traducciones distintas del mismo estado son dos pantallas que se
 * contradicen.
 */
export function runStatusLabel(status: string): string {
  if (status === 'COMPLETED') return 'Terminada';
  if (status === 'RUNNING') return 'En marcha';
  if (status === 'QUEUED') return 'En cola';
  if (status === 'FAILED') return 'Interrumpida';
  return status || '—';
}
