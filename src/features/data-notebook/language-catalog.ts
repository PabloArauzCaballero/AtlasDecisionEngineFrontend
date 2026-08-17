import { Code2, FileCode2, Sigma, Text, type LucideIcon } from 'lucide-react';
import type { NotebookCellKind, NotebookLanguage } from './notebook-types';

/**
 * La ÚNICA verdad sobre cómo se ve y cómo empieza cada lenguaje del cuaderno.
 *
 * Es el mismo patrón que `features/graph-editor/node-catalog.ts` usa para los tipos de nodo, y
 * existe por la misma razón medida: al añadir R, su nombre, su icono, su plantilla y su ejemplo
 * había que escribirlos en cinco archivos distintos —la barra de inserción, los botones de añadir,
 * el desplegable de la celda, el marcador de posición del editor y el estado del intérprete—. Cinco
 * sitios significa que el quinto se olvida, y lo que se ve entonces no es un error: es una celda
 * rotulada «R» que abre con la plantilla de Python.
 *
 * ## Qué NO está aquí: el color
 *
 * El color de cada lenguaje vive en `theme.css` (`--lang-*`) y se aplica por CSS a partir del
 * atributo `data-language`. La regla del repositorio es que ningún color se escribe fuera de la
 * hoja de tema —si no, al conmutar a oscuro queda ilegible y hay que parchearlo en otro archivo—, y
 * un catálogo de TypeScript con hexadecimales dentro es exactamente esa trampa con otro nombre.
 */
export interface IdentidadDeLenguaje {
  /** Como se nombra en pantalla. Va SIEMPRE junto al color: el color solo no informa. */
  readonly label: string;
  readonly Icon: LucideIcon;
  /** El identificador de gramática de Monaco. Los tres vienen de serie con el editor. */
  readonly monaco: string;
  /** Con qué abre una celda nueva. */
  readonly plantilla: string;
  /**
   * El ejemplo que se ve en una celda vacía.
   *
   * Los tres hacen LO MISMO —contar por estado— a propósito: quien cambia de lenguaje en el
   * desplegable puede comparar la misma pregunta escrita de tres formas, que es la manera de
   * decidir en cuál trabajar sin abrir la documentación de ninguno.
   */
  readonly ejemplo: string;
}

export const LENGUAJES: Record<NotebookLanguage, IdentidadDeLenguaje> = {
  python: {
    label: 'Python',
    Icon: FileCode2,
    monaco: 'python',
    plantilla:
      '# rows es la página cargada; df es el mismo dato como DataFrame de pandas.\ndf.head()',
    ejemplo: 'df.groupby("status").size()',
  },
  r: {
    label: 'R',
    Icon: Sigma,
    // Monaco registra R de serie (`vs/languages/definitions/r/register.js`, que `editor.main`
    // importa), así que el resaltado llega sin añadir nada al bundle.
    monaco: 'r',
    // En R la última expresión ES el resultado, así que la plantilla no «devuelve» nada: lo deja
    // escrito. `n` viene del preámbulo y ahorra el `nrow(df)` de la primera celda.
    plantilla:
      '# df es la página cargada como data.frame; columns son sus nombres y n, las filas.\nhead(df)',
    ejemplo: 'table(df$status)',
  },
  javascript: {
    label: 'JavaScript',
    Icon: Code2,
    monaco: 'javascript',
    plantilla:
      '// rows es la página cargada. Devuelve una lista de objetos para ver una tabla.\nreturn rows.slice(0, 10);',
    ejemplo: 'return rows.filter((fila) => fila.status === "ACTIVE")',
  },
};

/** El orden en que se ofrecen los tres. Se declara una vez y lo siguen todas las pantallas. */
export const ORDEN_LENGUAJES: readonly NotebookLanguage[] = ['python', 'r', 'javascript'];

/** El comentario no es un lenguaje, pero comparte sitio con ellos en las barras. */
export const COMENTARIO = { label: 'Comentario', Icon: Text } as const;

/**
 * El valor de `data-language` que la hoja de estilos lee para pintar la identidad.
 *
 * Un comentario devuelve `markdown` y no su lenguaje interno: la celda no corre en ningún
 * intérprete, y heredar el color de Python —que es el que lleva dentro por omisión— diría que sí.
 */
export function marcaDeCelda(kind: NotebookCellKind, language: NotebookLanguage): string {
  return kind === 'markdown' ? 'markdown' : language;
}
