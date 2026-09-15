/**
 * La opción de un desplegable, ÚNICA en todo el portal.
 *
 * Había tres formas idénticas y separadas —`CreateFieldOption` (motor
 * declarativo), `CatalogOption` (`CatalogInput`) y `PickerOption`
 * (`PickerSelect`)—, todas `{ value, label }`. Mientras estuvieron separadas
 * nadie podía añadir «qué significa esta opción» en un solo sitio: había que
 * tocar tres contratos y tres renderizados. Aquí hay uno.
 *
 * `description` es lo que separa una lista de palabras a adivinar de una lista
 * que se puede elegir sin conocer el modelo de datos: qué significa la opción y
 * cuándo elegirla. Se pinta SIEMPRE en la fila de la lista (segunda línea) y la
 * elegida la repite bajo el campo.
 *
 * Cuándo va vacía, a propósito: cuando la opción es una ENTIDAD que sale de los
 * datos (un artefacto, una versión, un caso) y no hay ficha que resumir. Una
 * descripción inventada es peor que ninguna.
 */
export interface Option {
  value: string;
  label: string;
  /** Qué significa y cuándo elegirla. Sin inventar: si no se sabe, va vacía. */
  description?: string;
  disabled?: boolean;
}

/** Catálogo de dominio cerrado: valor → qué significa. Fuente de `description`. */
export type OptionDescriptions = Readonly<Record<string, string>>;

/**
 * Construye las opciones de un dominio cerrado a partir de su mapa de textos.
 * Cada `*-help.ts` del repositorio exporta un mapa así y esta función lo cose
 * con las etiquetas, de modo que añadir un valor sin explicarlo salte a la vista
 * (y lo denuncie `scripts/check-field-help.mjs`).
 */
export function withDescriptions(
  options: readonly { value: string; label: string; disabled?: boolean }[],
  descriptions: OptionDescriptions,
): Option[] {
  return options.map((option) => ({
    ...option,
    description: descriptions[option.value],
  }));
}
