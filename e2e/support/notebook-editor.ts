import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Cómo se escribe y se lee una celda del cuaderno, ahora que el editor es Monaco.
 *
 * Existe por un desajuste que dejó diez pruebas en rojo sin que ninguna dijera la
 * verdad sobre lo que pasaba. `NotebookCodeEditor` sustituyó el `<textarea>` por
 * Monaco y dejó aquél **sólo como respaldo mientras Monaco no ha montado**:
 *
 * ```tsx
 * if (!listo) return <textarea className="notebook-cell__code" … />;
 * return <div className="notebook-cell__editor">…<Editor …/></div>;
 * ```
 *
 * Las baterías seguían buscando `.notebook-cell__code` y haciéndole `fill()`. Con
 * el editor ya montado ese elemento no existe, así que el localizador agotaba sus
 * noventa segundos y el fallo se leía como «la celda no se añadió» — cuando la
 * celda estaba ahí y lo que faltaba era el textarea. El síntoma delataba el
 * patrón: fallaban TODAS las pruebas que tecleaban en una celda y pasaban todas
 * las que no.
 *
 * ## Tres reglas que este módulo impone
 *
 * **Se teclea de verdad, no se inyecta en el modelo de Monaco.** Es la misma
 * decisión que documenta `sql-console.spec.ts`: el contenido viaja por `onChange`,
 * y una prueba que escribiera en el modelo por debajo dejaría sin comprobar
 * justamente ese cable, que es el que se rompe al refactorizar el editor.
 *
 * **Los comentarios NO son Monaco.** Una celda de tipo comentario sigue siendo un
 * `<textarea>` de verdad (`NotebookCellView`), y tratarla como editor de código
 * buscaría un `.monaco-editor` que ahí nunca aparece.
 *
 * **Leer no es `toHaveValue`.** Aquello sólo sirve sobre un control de formulario
 * y Monaco no lo es; además pinta los espacios como ` ` y reparte el texto en
 * un `div` por línea, así que comparar sin normalizar produce una diferencia que
 * se lee como un fallo del editor y es un detalle de cómo dibuja.
 */

/** La celda `indice` (base 0) del cuaderno abierto. */
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
export async function escribirEnCelda(
  page: Page,
  indice: number,
  contenido: string,
): Promise<void> {
  const bloque = await esperarCelda(page, indice);
  const editor = bloque.locator('.notebook-cell__editor .monaco-editor').first();

  if ((await editor.count()) === 0) {
    // Comentario: `fill` de toda la vida, que además es atómico y no deja el
    // contenido a medias si la prueba se corta.
    const area = bloque.locator('.notebook-cell__code').first();
    await area.click();
    await area.fill(contenido);
    return;
  }

  await teclear(page, editor, contenido);

  /*
   * Se COMPRUEBA que lo escrito llegó, y si no se repite una vez.
   *
   * No es un cinturón por si acaso: al cambiar el lenguaje de una celda Monaco se
   * remonta, y un tecleo que caiga en ese instante se pierde entero. La celda se
   * queda con la plantilla de serie (`df.head()`), que ejecutada como JavaScript
   * revienta — y el fallo aparece tres aserciones más abajo como «la salida no
   * tiene tabla», que no señala a ninguna parte. Medido: en una corrida de 22,
   * seis pruebas caían así de forma intermitente.
   */
  if ((await leerCelda(page, indice)) === normalizar(contenido)) return;
  await teclear(page, editor, contenido);
  await expect.poll(() => leerCelda(page, indice), { timeout: 10_000 }).toBe(normalizar(contenido));
}

/**
 * `insertText` y no `type`, y la diferencia importa en las dos direcciones.
 *
 * Sigue entrando por el pipeline de entrada real —Monaco lo procesa y dispara su
 * `onChange`, que es el cable que estas pruebas existen para comprobar—, pero no
 * simula pulsación por pulsación, así que ni dispara el autocierre de paréntesis
 * —que convertiría `nrow(activos)` en `nrow(activos))`— ni abre el globo de
 * sugerencias, que se traga el `Ctrl+Enter` de la prueba siguiente.
 */
async function teclear(page: Page, editor: Locator, contenido: string): Promise<void> {
  await editor.click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(contenido);
}

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
  return normalizar(await lineas.innerText());
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

/**
 * Afirma el contenido de una celda.
 *
 * Se sondea en vez de comparar una vez: así se le da tiempo al valor a llegar por
 * `onChange` y volver pintado, que es el camino que interesa comprobar.
 */
export async function esperarContenido(
  page: Page,
  indice: number,
  esperado: string,
): Promise<void> {
  await expect.poll(() => leerCelda(page, indice), { timeout: 15_000 }).toBe(normalizar(esperado));
}

/**
 * Despliega el historial, que nace PLEGADO.
 *
 * Antes estaba siempre abierto y las pruebas afirmaban directamente sobre su
 * contenido. Al volverse plegable, esas aserciones pasaron a buscar elementos que
 * existen pero no están montados — y el fallo, «no encuentro el estado vacío», no
 * dice en ningún momento que lo que falta es un clic.
 */
export async function abrirHistorial(page: Page): Promise<void> {
  const desplegable = page.locator('.notebook-history__toggle');
  await expect(desplegable).toBeVisible({ timeout: 30_000 });
  if ((await desplegable.getAttribute('aria-expanded')) === 'true') return;
  await desplegable.click();
  await expect(desplegable).toHaveAttribute('aria-expanded', 'true');
}

/** Ejecuta la celda con su botón y espera a que publique salida. */
export async function ejecutarCelda(page: Page, indice: number): Promise<void> {
  await celda(page, indice).locator('.notebook-cell__run').click();
  await expect(celda(page, indice).locator('.notebook-cell__output')).toBeVisible({
    timeout: 60_000,
  });
}

/**
 * Ejecuta con el atajo, que es otra cosa que ejecutar con el botón.
 *
 * El atajo lo registra el PROPIO editor (`editor.addCommand`), así que hay que
 * pulsarlo con el foco dentro de Monaco. Hacerlo sobre un elemento de alrededor
 * comprobaría que el navegador ignora una combinación de teclas, que es una
 * afirmación cierta y sin ningún valor.
 */
export async function ejecutarConAtajo(page: Page, indice: number): Promise<void> {
  const bloque = await esperarCelda(page, indice);
  await bloque.locator('.notebook-cell__editor .monaco-editor').first().click();
  await page.keyboard.press('ControlOrMeta+Enter');
}
