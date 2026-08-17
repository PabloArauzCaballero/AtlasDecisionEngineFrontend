/**
 * Minimotor de Markdown: del texto a un árbol, sin pasar por HTML.
 *
 * Lo que gobierna el diseño es lo que NO se hace: no se genera una cadena de HTML ni se toca
 * `dangerouslySetInnerHTML`. El resultado de este archivo es un árbol de nodos que la vista
 * convierte en elementos de React, así que el texto de una celda no puede convertirse en marcado
 * aunque contenga `<script>`. Un renderizador que produce HTML necesita después un saneador, y el
 * saneador es donde vive el fallo: aquí no hay ninguno que mantener.
 *
 * Es un SUBCONJUNTO deliberado —encabezados, énfasis, código, listas, citas, enlaces, reglas y
 * tablas no—: lo que hace falta para anotar un análisis. Aceptar más gramática sin tener con qué
 * probarla sólo añade formas de que el texto salga distinto de lo que se escribió.
 */

export type InlineNode =
  | { type: 'text'; value: string }
  | { type: 'strong'; children: InlineNode[] }
  | { type: 'em'; children: InlineNode[] }
  | { type: 'code'; value: string }
  | { type: 'link'; href: string; children: InlineNode[] };

export type MarkdownBlock =
  | { type: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; children: InlineNode[] }
  | { type: 'paragraph'; children: InlineNode[] }
  | { type: 'code'; value: string; language: string | null }
  | { type: 'list'; ordered: boolean; items: InlineNode[][] }
  | { type: 'quote'; children: InlineNode[] }
  | { type: 'rule' };

/**
 * Qué destinos se admiten en un enlace.
 *
 * `javascript:` es la razón de que esto exista: `[pulsa](javascript:…)` es la forma clásica de
 * meter ejecución en un texto que parecía sólo un comentario. Se admite lo que puede ser un enlace
 * de verdad en este portal —web, correo, ancla y ruta interna— y todo lo demás se queda como TEXTO
 * VISIBLE, con su destino a la vista: borrarlo escondería lo que alguien intentó.
 */
export function enlaceSeguro(href: string): boolean {
  const limpio = href.trim();
  if (/^(https?:|mailto:)/i.test(limpio)) return true;
  return /^[/#]/.test(limpio);
}

const PATRON_INLINE = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(_[^_]+_)|(\[[^\]]*\]\([^)\s]+\))/;

function parseInline(texto: string): InlineNode[] {
  const nodos: InlineNode[] = [];
  let resto = texto;

  while (resto) {
    const encontrado = PATRON_INLINE.exec(resto);
    if (!encontrado || encontrado.index === undefined) {
      nodos.push({ type: 'text', value: resto });
      break;
    }

    if (encontrado.index > 0) {
      nodos.push({ type: 'text', value: resto.slice(0, encontrado.index) });
    }

    const marca = encontrado[0];
    if (marca.startsWith('`')) {
      nodos.push({ type: 'code', value: marca.slice(1, -1) });
    } else if (marca.startsWith('**')) {
      nodos.push({ type: 'strong', children: parseInline(marca.slice(2, -2)) });
    } else if (marca.startsWith('*') || marca.startsWith('_')) {
      nodos.push({ type: 'em', children: parseInline(marca.slice(1, -1)) });
    } else {
      const corte = marca.indexOf('](');
      const rotulo = marca.slice(1, corte);
      const destino = marca.slice(corte + 2, -1);
      if (enlaceSeguro(destino)) {
        nodos.push({ type: 'link', href: destino.trim(), children: parseInline(rotulo) });
      } else {
        // Se enseña tal cual se escribió, destino incluido. Ver `enlaceSeguro`.
        nodos.push({ type: 'text', value: marca });
      }
    }

    resto = resto.slice(encontrado.index + marca.length);
  }

  return nodos.filter((nodo) => nodo.type !== 'text' || nodo.value !== '');
}

function esLista(linea: string): { ordered: boolean; contenido: string } | null {
  const vinieta = /^\s*[-*+]\s+(.*)$/.exec(linea);
  if (vinieta) return { ordered: false, contenido: vinieta[1] };
  const numerada = /^\s*\d+[.)]\s+(.*)$/.exec(linea);
  if (numerada) return { ordered: true, contenido: numerada[1] };
  return null;
}

export function parseMarkdown(source: string): MarkdownBlock[] {
  const lineas = source.replace(/\r\n?/g, '\n').split('\n');
  const bloques: MarkdownBlock[] = [];
  let parrafo: string[] = [];

  const cerrarParrafo = () => {
    if (!parrafo.length) return;
    bloques.push({ type: 'paragraph', children: parseInline(parrafo.join(' ')) });
    parrafo = [];
  };

  for (let indice = 0; indice < lineas.length; indice += 1) {
    const linea = lineas[indice];

    if (linea.trimStart().startsWith('```')) {
      cerrarParrafo();
      const idioma = linea.trim().slice(3).trim();
      const cuerpo: string[] = [];
      indice += 1;
      // Un bloque sin cerrar llega hasta el final A PROPÓSITO: mientras se escribe, la valla de
      // cierre todavía no está, y tratarlo como texto suelto haría parpadear todo el comentario.
      while (indice < lineas.length && !lineas[indice].trimStart().startsWith('```')) {
        cuerpo.push(lineas[indice]);
        indice += 1;
      }
      bloques.push({ type: 'code', value: cuerpo.join('\n'), language: idioma || null });
      continue;
    }

    if (!linea.trim()) {
      cerrarParrafo();
      continue;
    }

    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(linea)) {
      cerrarParrafo();
      bloques.push({ type: 'rule' });
      continue;
    }

    const encabezado = /^(#{1,6})\s+(.*)$/.exec(linea);
    if (encabezado) {
      cerrarParrafo();
      bloques.push({
        type: 'heading',
        level: encabezado[1].length as 1 | 2 | 3 | 4 | 5 | 6,
        children: parseInline(encabezado[2]),
      });
      continue;
    }

    const cita = /^\s*>\s?(.*)$/.exec(linea);
    if (cita) {
      cerrarParrafo();
      bloques.push({ type: 'quote', children: parseInline(cita[1]) });
      continue;
    }

    const punto = esLista(linea);
    if (punto) {
      cerrarParrafo();
      const items: InlineNode[][] = [parseInline(punto.contenido)];
      // Los puntos consecutivos son UNA lista: uno por bloque los separaría con el margen de
      // párrafo y se leerían como frases sueltas en vez de como una enumeración.
      while (indice + 1 < lineas.length) {
        const siguiente = esLista(lineas[indice + 1]);
        if (!siguiente || siguiente.ordered !== punto.ordered) break;
        items.push(parseInline(siguiente.contenido));
        indice += 1;
      }
      bloques.push({ type: 'list', ordered: punto.ordered, items });
      continue;
    }

    parrafo.push(linea.trim());
  }

  cerrarParrafo();
  return bloques;
}
