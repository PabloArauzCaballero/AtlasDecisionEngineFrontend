/**
 * El `id` de una entrada de campo calculado es un nombre LOCAL y el servidor exige
 * `^[a-z][a-z0-9_]{1,119}$`. El selector del catálogo lo copiaba tal cual del código de la variable,
 * y las variables creadas desde el portal se guardan en MAYÚSCULAS: al elegir una, la versión
 * respondía 400 (`inputs.0.id must match …`) y el campo se quedaba creado sin versión (QA 2026-10-29,
 * BUG-9). Se normaliza aquí, en un solo sitio, y el filtro de «ya elegidas» compara contra lo mismo.
 */
export function inputIdFromVariableCode(code: string): string {
  const base = code
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const conLetra = /^[a-z]/.test(base) ? base : `v_${base}`;
  const conLargo = conLetra.length < 2 ? `${conLetra}_1` : conLetra;
  return conLargo.slice(0, 120);
}
