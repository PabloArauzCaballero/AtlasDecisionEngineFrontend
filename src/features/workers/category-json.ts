import type { SemanticCategory } from './categories.api';
import { armarArbol, type NodoCategoria } from './category-tree.model';

/**
 * El árbol de categorías como JSON, con la jerarquía DENTRO del archivo.
 *
 * **Por qué anidado y no una lista plana.** La descarga en CSV ya existía y es
 * la buena para editar en una hoja: filas y columnas. Pero un catálogo también
 * se lee, se revisa y se archiva, y para eso una lista de doscientas filas donde
 * la jerarquía sólo vive en una columna `parentCode` obliga a reconstruir el
 * árbol mentalmente —o con un script— antes de poder mirar nada. El JSON
 * anidado ES el árbol: se abre y se ve la forma del catálogo.
 *
 * **Se descarga ENTERO.** Lo que se exporta es el catálogo que devuelve la API,
 * no lo que está expandido en pantalla. Una descarga que dependiera del plegado
 * produciría dos archivos distintos según cómo estuviera la vista, y el que
 * faltara ramas no lo diría en ninguna parte.
 *
 * **Vuelve a subirse.** `leerJson` acepta este mismo documento: la jerarquía se
 * aplana leyendo la POSICIÓN de cada nodo. Un formato de salida que el propio
 * importador no admite es una trampa —se descarga, se edita, se sube y rebota—.
 */

/** Un nodo del archivo. Los campos editables son los mismos que las columnas del CSV. */
export interface CategoriaExportada {
  code: string;
  name: string;
  description: string;
  acceptanceThreshold: number;
  positiveExamples: string[];
  counterExamples: string[];
  restrictions: string[];
  relatedCategoryCodes: string[];
  /** Informativos: se exportan para que el archivo sea fiel, el importador no los lee. */
  isActive: boolean;
  version: number;
  children: CategoriaExportada[];
}

export interface ArbolExportado {
  exportedAt: string;
  /** Categorías totales, contando todos los niveles: valida que no falte ninguna. */
  total: number;
  categories: CategoriaExportada[];
}

function exportarNodo(nodo: NodoCategoria): CategoriaExportada {
  const { categoria } = nodo;
  return {
    code: categoria.code,
    name: categoria.name,
    description: categoria.description,
    acceptanceThreshold: categoria.acceptanceThreshold,
    positiveExamples: [...categoria.positiveExamples],
    counterExamples: [...categoria.counterExamples],
    restrictions: [...categoria.restrictions],
    relatedCategoryCodes: [...categoria.relatedCategoryCodes],
    isActive: categoria.isActive,
    version: categoria.version,
    children: nodo.hijas.map(exportarNodo),
  };
}

/** El catálogo completo como documento anidado. */
export function categoriasAArbolExportado(
  categorias: readonly SemanticCategory[],
  momento: Date = new Date(),
): ArbolExportado {
  return {
    exportedAt: momento.toISOString(),
    total: categorias.length,
    categories: armarArbol(categorias).map(exportarNodo),
  };
}

/** El mismo documento, ya serializado y con sangría: se abre y se lee. */
export function categoriasAJson(categorias: readonly SemanticCategory[], momento?: Date): string {
  return `${JSON.stringify(categoriasAArbolExportado(categorias, momento), null, 2)}\n`;
}

function esRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

/**
 * Convierte un documento anidado en la lista plana que el importador entiende.
 *
 * Devuelve `null` si esto no es un documento anidado —un array suelto, o
 * cualquier otra cosa—, para que quien llama siga con su camino de siempre en
 * vez de tragarse un formato que no reconoce.
 *
 * **La posición manda sobre `parentCode`.** En un archivo anidado la jerarquía
 * es dónde está escrito cada nodo; si además llevara un `parentCode` viejo de
 * cuando colgaba de otra rama, hacerle caso movería la categoría de vuelta al
 * sitio del que alguien acaba de sacarla editando el archivo.
 */
export function aplanarExportacion(dato: unknown): unknown[] | null {
  if (!esRegistro(dato) || !Array.isArray(dato.categories)) return null;

  const filas: unknown[] = [];
  const recorrer = (nodos: readonly unknown[], padre: string | null): void => {
    for (const nodo of nodos) {
      if (!esRegistro(nodo)) {
        // Se conserva TAL CUAL para que el lector lo señale con su propio
        // mensaje —«la categoría 3 no es un objeto»—. Sustituirlo por un
        // registro vacío lo convertiría en «le falta el código», que manda a
        // buscar el fallo a la columna equivocada.
        filas.push(nodo);
        continue;
      }
      const { children, ...resto } = nodo;
      filas.push({ ...resto, parentCode: padre });
      if (Array.isArray(children)) {
        recorrer(children, typeof nodo.code === 'string' ? nodo.code : padre);
      }
    }
  };
  recorrer(dato.categories, null);
  return filas;
}
