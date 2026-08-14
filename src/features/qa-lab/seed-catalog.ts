/**
 * Semillas con nombre, en vez de un campo de texto libre.
 *
 * Una semilla no es un ajuste: es el NOMBRE de un lote concreto de casos. La misma
 * semilla sobre la misma versión vuelve a generar exactamente las mismas entradas, y ahí
 * está todo su valor —comparar dos versiones con el mismo lote, o reproducir meses
 * después el caso que falló—. Tecleada a mano no sirve para nada de eso: cada persona
 * escribía una cadena distinta, así que dos corridas nunca eran comparables y nadie sabía
 * cuál repetir.
 *
 * El catálogo son convenciones de equipo, no magia: `qa-base` no genera «casos base», sino
 * los mismos casos que la última vez que alguien usó `qa-base`. Por eso los nombres dicen
 * PARA QUÉ se usa cada lote y no qué contiene.
 *
 * Ojo con lo que la misma semilla NO promete: el lote depende también del contrato, así
 * que `qa-base` sobre dos versiones con entradas distintas da casos distintos. Eso es lo
 * correcto —no hay forma de generar un entero fuera del rango que la versión declara—,
 * pero conviene saberlo antes de leer dos informes uno al lado del otro.
 */
export interface QaSeedEntry {
  seed: string;
  label: string;
  hint: string;
}

/** Vacío = que la genere el motor. Es el camino normal para una exploración cualquiera. */
export const GENERATED_SEED = '';

export const QA_SEED_CATALOG: readonly QaSeedEntry[] = [
  {
    seed: 'qa-base',
    label: 'Base',
    hint: 'El lote de referencia. Úsalo para comparar dos versiones del mismo algoritmo: mismo lote, misma vara de medir.',
  },
  {
    seed: 'qa-regresion',
    label: 'Regresión',
    hint: 'El lote que se repite en cada cambio. Si hoy falla algo que ayer pasaba, lo rompió el cambio y no el azar.',
  },
  {
    seed: 'qa-frontera',
    label: 'Frontera',
    hint: 'El lote que se guarda para las tandas con mucho porcentaje de casos límite e inválidos.',
  },
  {
    seed: 'qa-revision',
    label: 'Revisión',
    hint: 'El lote que se adjunta a una aprobación, para que quien revise pueda repetir la corrida tal cual.',
  },
];

/** Explicación de la semilla elegida, para el pie del desplegable. */
export function describeSeed(seed: string, used: readonly string[]): string {
  if (seed === GENERATED_SEED) {
    return 'El motor genera una y la archiva con la corrida, así que esta tanda también se podrá repetir después.';
  }
  const known = QA_SEED_CATALOG.find((entry) => entry.seed === seed);
  if (known) return known.hint;
  if (used.includes(seed)) {
    return 'Semilla de una corrida anterior de esta versión: repite exactamente aquel lote de casos.';
  }
  return 'Semilla archivada. Repite el mismo lote de casos sobre esta versión.';
}

/**
 * Las semillas ya usadas que no están en el catálogo, de más reciente a más antigua.
 *
 * Salen del historial que la pantalla ya carga. Son las únicas semillas «sueltas» que
 * tiene sentido ofrecer: las generó el motor y hay una corrida detrás de cada una.
 */
export function usedSeedsOf(history: readonly { seed: string }[]): string[] {
  const catalog = new Set(QA_SEED_CATALOG.map((entry) => entry.seed));
  const seen = new Set<string>();
  const seeds: string[] = [];
  for (const entry of history) {
    if (!entry.seed || catalog.has(entry.seed) || seen.has(entry.seed)) continue;
    seen.add(entry.seed);
    seeds.push(entry.seed);
  }
  return seeds;
}
