import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Leer una celda del cuaderno: dónde está y qué dice.
 *
 * Vive aparte de `notebook-editor.ts` porque son dos oficios distintos —mirar y actuar— y juntos
 * pasaban del tope de 299 líneas del repositorio. Lo que se lee aquí lo usan tanto las pruebas como
 * la propia escritura, que comprueba lo que acaba de escribir.
 */

export function celda(page: Page, indice: number): Locator {
  return page.locator('.notebook-cell').nth(indice);
}

/**
 * Espera a que la celda esté lista para recibir teclas.
 *
 * Sin esto, escribir en el instante entre el primer pintado y el montaje de
 * Monaco se pierde: el respaldo desaparece con lo que se hubiera escrito.
 */
export async function esperarCelda(page: Page, indice: number): Promise<Locator> {
  const bloque = celda(page, indice);
  await expect(bloque).toBeVisible({ timeout: 30_000 });
  await expect(
    bloque.locator('.notebook-cell__editor .monaco-editor, .notebook-cell__code').first(),
  ).toBeVisible({ timeout: 30_000 });
  return bloque;
}

/** Reemplaza el contenido de una celda, sea de código (Monaco) o comentario. */
/**
 * Lo que la celda muestra, con los blancos colapsados.
 *
 * Monaco pinta los espacios como espacio duro y, con `wordWrap: 'on'`, parte una
 * linea larga en dos VISUALES: su `innerText` mete entonces un salto que el
 * contenido no tiene. Comparar tal cual convierte un ajuste de linea en una
 * diferencia, y eso se lee como que el editor perdio texto cuando lo unico que
 * hizo fue envolverlo. Se colapsan los blancos porque ninguna prueba de este
 * cuaderno afirma sobre la disposicion de los saltos, sino sobre QUE hay escrito.
 */
export async function leerCelda(page: Page, indice: number): Promise<string> {
  const bloque = celda(page, indice);
  /*
   * Traer la celda a la vista ANTES de leerla no es cortesía: Monaco VIRTUALIZA,
   * y un editor fuera del viewport puede no tener sus `.view-lines` pintadas. La
   * prueba del avance restaurado hace antes una captura `fullPage`, que desplaza
   * la página, y leía en blanco un editor cuyo contenido estaba —el volcado del
   * DOM lo enseñaba— pero no dibujado.
   */
  await bloque.scrollIntoViewIfNeeded();
  const lineas = bloque.locator('.notebook-cell__editor .monaco-editor .view-lines').first();
  if ((await lineas.count()) === 0) {
    return normalizar(await bloque.locator('.notebook-cell__code').first().inputValue());
  }
  /*
   * Las líneas se ordenan por su posición VISUAL (`top`), no por el orden del DOM.
   *
   * Monaco reutiliza los nodos `.view-line` al desplazar y los coloca en absoluto: el orden en el
   * árbol NO es el orden del documento. Leer con `innerText` devolvía el texto correcto con las
   * líneas cambiadas de sitio, y como la comparación es literal, el ayudante concluía que el editor
   * había perdido lo escrito y volvía a escribirlo, duplicándolo. Se veía sólo con varias líneas:
   * el fallo del gráfico de pyplot era exactamente esto —la primera línea leída al final— y estuvo
   * escondido detrás de lo que parecía un problema de tecleo.
   */
  return normalizar(
    await lineas.evaluate((nodo) =>
      [...nodo.querySelectorAll('.view-line')]
        .map((linea) => ({
          arriba: Number.parseFloat((linea as HTMLElement).style.top) || 0,
          texto: (linea as HTMLElement).innerText,
        }))
        .sort((una, otra) => una.arriba - otra.arriba)
        .map((linea) => linea.texto)
        .join('\n'),
    ),
  );
}

/**
 * Compara SIN blancos, y la razón es que el ajuste de línea inventa un límite.
 *
 * Con `wordWrap: 'on'`, Monaco parte una línea larga en dos visuales y su
 * `innerText` mete ahí un salto: `f.open_case_count` vuelve leído como
 * `f.
open_case_count`. Colapsar los blancos a uno no arregla eso —deja un
 * espacio donde el contenido no tenía ninguno—, así que hay que quitarlos.
 *
 * El precio, dicho para que nadie se lleve una sorpresa: estas comparaciones no
 * distinguen `# primera` de `#primera`. Es aceptable porque lo que preguntan es
 * «¿llegó ESTE contenido?» y no «¿está exactamente así de espaciado»; afirmar lo
 * segundo sobre el DOM de un editor que envuelve líneas sería afirmar sobre cómo
 * dibuja, no sobre qué guarda.
 */
export function normalizar(texto: string): string {
  return texto.replace(/\s+/gu, '');
}
