import { expect, type Locator, type Page } from '@playwright/test';
import { celda, esperarCelda, leerCelda, normalizar } from './notebook-lectura';

export { celda, esperarCelda, leerCelda, normalizar };

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
export async function escribirEnCelda(
  page: Page,
  indice: number,
  contenido: string,
): Promise<void> {
  const bloque = await esperarCelda(page, indice);

  /*
   * Se ESPERA a que Monaco monte antes de decidir por dónde escribir.
   *
   * El `textarea.notebook-cell__code` existe sólo en el instante anterior al montaje, así que
   * preguntar «¿hay editor?» y caer al textarea si aún no lo hay es una carrera que se pierde sola:
   * Playwright resolvía el textarea, intentaba pulsarlo, lo encontraba inestable y acababa con
   * «element was detached from the DOM» a los 60 s. Le pasaba a la prueba de mover celdas, donde la
   * celda nueva se escribe recién creada. Una celda de comentario no monta Monaco nunca, y para ésa
   * sigue existiendo el camino del textarea — por eso se espera con plazo en vez de exigirlo.
   */
  const editorMontado = bloque.locator('.notebook-cell__editor .monaco-editor').first();
  const hayEditor = await editorMontado
    .waitFor({ state: 'visible', timeout: 15_000 })
    .then(() => true)
    .catch(() => false);

  if (!hayEditor) {
    // Comentario: `fill` de toda la vida, que además es atómico y no deja el
    // contenido a medias si la prueba se corta.
    const area = bloque.locator('.notebook-cell__code').first();
    await area.click();
    await area.fill(contenido);
    return;
  }

  /*
   * Dos intentos, y cada uno REHACE el camino entero: localizar el editor, enfocarlo de verdad,
   * vaciarlo comprobando que quedó vacío, y sólo entonces escribir.
   *
   * Antes se localizaba el editor UNA vez, se daba el foco por hecho tras el `click()` y no se
   * comprobaba el vaciado. Cambiar el lenguaje de una celda REMONTA Monaco, así que el nodo
   * localizado podía ser el anterior y el `Ctrl+A`/`Delete` caía en el hueco del remontaje
   * mientras el `insertText` posterior sí llegaba al editor nuevo: la celda se quedaba con la
   * plantilla de serie MÁS lo escrito, el reintento volvía a no vaciar y sumaba una copia más, y
   * el fallo salía como «esperaba X, recibí df.head()XX» diez segundos después. Siete pruebas del
   * cuaderno caían por esto —JavaScript, Python y R—, y ninguna señalaba al remontaje.
   */
  for (const intento of [1, 2, 3]) {
    const editor = bloque.locator('.notebook-cell__editor .monaco-editor').first();
    await editor.waitFor({ state: 'visible' });
    await enfocarEditor(page, editor);
    await vaciar(page, indice, editor);
    await esperarAsentado(page, indice);
    await page.keyboard.insertText(contenido);
    if ((await leerCelda(page, indice)) === normalizar(contenido)) return;
    if (intento === 3) {
      await expect
        .poll(() => leerCelda(page, indice), { timeout: 10_000 })
        .toBe(normalizar(contenido));
    }
  }
}

/**
 * El foco se COMPRUEBA, no se supone.
 *
 * `click()` sobre el contenedor de Monaco devuelve el control en cuanto el ratón hizo su trabajo,
 * pero quien recibe las teclas es un elemento que el editor monta aparte. Entre una cosa y otra hay
 * un hueco —más ancho justo después de un remontaje— donde las pulsaciones se pierden sin error: el
 * editor sigue ahí, la prueba sigue adelante, y lo que no llegó no lo dice nadie.
 *
 * Se comprueba que el elemento activo esté DENTRO del editor, y no que sea un nodo concreto, porque
 * cuál es depende de la versión: esta monta un `div.native-edit-context` (la API EditContext del
 * navegador) y las anteriores un `textarea.inputarea` oculto. Medido en esta corrida: buscando el
 * textarea, la comprobación fallaba siempre aunque el foco fuese correcto.
 */
async function enfocarEditor(page: Page, editor: Locator): Promise<void> {
  await editor.click();
  await expect
    .poll(() => editor.evaluate((nodo) => nodo.contains(nodo.ownerDocument.activeElement)), {
      timeout: 5_000,
    })
    .toBe(true);
}

/**
 * Vaciar es un PASO con su propia comprobación, y se hace a RETROCESOS, no con `Ctrl+A`.
 *
 * Medido en esta versión de Monaco, que usa la API `EditContext` del navegador (monta un
 * `div.native-edit-context` en vez del `textarea` oculto de siempre): **ningún atajo de selección
 * llega a su gestor de teclas**. `Meta+a`, `Control+a`, `ControlOrMeta+a` e incluso ir al principio
 * y seleccionar hasta el final dejan el documento sin seleccionar, mientras `insertText` sí entra
 * — así que cada intento APILABA texto sobre la plantilla de serie en lugar de sustituirla. Ése era
 * el «df.head()XX» que rompía siete pruebas del cuaderno.
 *
 * `Backspace` sí llega. Se cuenta cuánto hay y se borra carácter a carácter desde el final: es más
 * lento (celdas de pocas líneas: milisegundos) pero no depende de ningún atajo, que además serían
 * distintos en macOS y en el Linux de la CI.
 */
async function vaciar(page: Page, indice: number, editor: Locator): Promise<void> {
  // Pulsar al fondo a la derecha deja el cursor al FINAL del documento: sin eso, los retrocesos
  // borrarían desde donde cayó el clic y dejarían cola detrás.
  const caja = await editor.boundingBox();
  if (caja) {
    await editor.click({
      position: { x: Math.max(caja.width - 4, 4), y: Math.max(caja.height - 4, 4) },
    });
  }
  for (let vuelta = 0; vuelta < 30; vuelta += 1) {
    const restante = await longitudCruda(page, indice);
    if (restante === 0) return;
    for (let pulsacion = 0; pulsacion < Math.min(restante, 40); pulsacion += 1) {
      await page.keyboard.press('Backspace');
    }
  }
  await expect.poll(() => leerCelda(page, indice), { timeout: 5_000 }).toBe('');
}

/**
 * Que la celda esté vacía UNA vez no basta: tiene que seguir vacía.
 *
 * El editor es controlado —el componente sincroniza su valor con el estado de React— y esa
 * sincronización llega un instante después del borrado. Si se escribe dentro de ese instante, el
 * re-render devuelve el cursor al principio A MITAD de la inserción y el texto sale REORDENADO: la
 * primera línea aparecía al final, con todo lo demás delante. Medido en el gráfico de pyplot, donde
 * el código tiene cinco líneas; con una sola línea el defecto no se ve, que es por lo que sobrevivió.
 */
async function esperarAsentado(page: Page, indice: number): Promise<void> {
  await expect
    .poll(
      async () => {
        const primera = await leerCelda(page, indice);
        await page.waitForTimeout(120);
        return primera + (await leerCelda(page, indice));
      },
      { timeout: 5_000 },
    )
    .toBe('');
}

/** Cuántos caracteres hay que borrar. Cruda —con blancos— porque cada uno es un retroceso. */
async function longitudCruda(page: Page, indice: number): Promise<number> {
  const lineas = celda(page, indice)
    .locator('.notebook-cell__editor .monaco-editor .view-lines')
    .first();
  if ((await lineas.count()) === 0) return 0;
  return (await lineas.innerText()).length;
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
  /*
   * `Control+Enter` y no `ControlOrMeta+Enter`, que es lo que había y no ejecutaba nada.
   *
   * Medido: con el editor enfocado, `Control+Enter` dispara la ejecución y `ControlOrMeta+Enter`
   * —que en macOS se traduce a `Meta`— no llega. La pantalla anuncia el atajo como «Ctrl+Enter» y
   * `NotebookCellView` lo atiende con `ctrlKey || metaKey`, así que pulsar Control es exactamente
   * lo que hace quien lee el botón, en cualquier sistema.
   */
  await page.keyboard.press('Control+Enter');
}
