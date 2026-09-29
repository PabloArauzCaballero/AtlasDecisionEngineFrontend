/**
 * El ambiente que se enseña en pantalla (DEV, TEST, PRODUCTION…), resuelto en EJECUCIÓN.
 *
 * Antes era sólo `NEXT_PUBLIC_ENVIRONMENT`, horneado al construir. `docker-compose.coolify.yml`
 * lo fija en `DEV` y TEST despliega con ese mismo archivo, así que el Motor de TEST decía
 * «Ambiente DEV — no es el entorno de producción» en la entrada y en la barra superior: una
 * afirmación falsa sobre dónde está trabajando la persona (medido el 2026-09-29).
 *
 * Orden, del más explícito al menos:
 * 1. `ENVIRONMENT_LABEL` del proceso del servidor: se cambia sin reconstruir.
 * 2. El nombre con el que se entra: un host con la etiqueta `test` (p. ej.
 *    `atlas.decisionengine.test.arauzsoftware.com`) es TEST, lo diga o no la imagen.
 * 3. Lo horneado al construir, como hasta ahora.
 */
export function resolveEnvironmentLabel(input: {
  runtimeLabel?: string | null;
  host?: string | null;
  bakedLabel?: string | null;
}): string {
  const runtime = normalize(input.runtimeLabel);
  if (runtime) return runtime;

  const hostname = (input.host ?? '').split(':')[0]?.toLowerCase() ?? '';
  if (hostname.split('.').includes('test')) return 'TEST';

  return normalize(input.bakedLabel);
}

function normalize(value?: string | null): string {
  return (value ?? '').trim().toUpperCase();
}
