'use client';

import { useState } from 'react';
import type { SemanticCategory } from './categories.api';

/**
 * La FORMA del árbol de categorías, separada de quien la pinta.
 *
 * Vivía dentro de `CategoryTree.tsx` y ahí sólo servía para dibujar. Pero la
 * jerarquía es también lo que se exporta —un JSON plano no es el catálogo, es
 * una lista de la que hay que volver a deducirlo— y lo que decide qué ramas se
 * pueden abrir o cerrar en bloque. Tres consumidores calculando lo mismo por su
 * cuenta es la vía más corta a que la descarga y la pantalla discrepen sobre
 * quién cuelga de quién.
 */

export interface NodoCategoria {
  categoria: SemanticCategory;
  hijas: NodoCategoria[];
  /** Hojas que cuelgan de aquí, a cualquier profundidad. */
  hojas: number;
}

/**
 * Arma el árbol. Una categoría cuyo padre no está en la lista se cuelga de la
 * raíz en vez de desaparecer: un catálogo con una referencia rota se tiene que
 * PODER VER para arreglarlo, y esconderla dejaría a alguien buscando una fila
 * que la API sí devuelve —y, peor, la dejaría fuera del archivo descargado sin
 * que nada lo dijera—.
 */
export function armarArbol(categorias: readonly SemanticCategory[]): NodoCategoria[] {
  const porCodigo = new Map(
    categorias.map((c) => [c.code, { categoria: c, hijas: [], hojas: 0 } as NodoCategoria]),
  );
  const raices: NodoCategoria[] = [];
  for (const nodo of porCodigo.values()) {
    const padre = nodo.categoria.parentCode;
    const nodoPadre = padre === null ? undefined : porCodigo.get(padre);
    if (nodoPadre === undefined) raices.push(nodo);
    else nodoPadre.hijas.push(nodo);
  }
  const preparar = (nodos: NodoCategoria[]): NodoCategoria[] =>
    nodos
      .sort((a, b) => a.categoria.code.localeCompare(b.categoria.code))
      .map((nodo) => {
        const hijas = preparar(nodo.hijas);
        const hojas = hijas.length === 0 ? 1 : hijas.reduce((total, hija) => total + hija.hojas, 0);
        return { ...nodo, hijas, hojas };
      });
  return preparar(raices);
}

/**
 * Los códigos de todo lo que es RAMA, a cualquier profundidad.
 *
 * Es lo que «colapsar todo» tiene que cerrar. Cerrar sólo el primer nivel deja
 * el árbol con el mismo aspecto que tenía —las hijas siguen abiertas por dentro—
 * y el botón parece no hacer nada.
 */
export function codigosDeRama(nodos: readonly NodoCategoria[]): string[] {
  return nodos.flatMap((nodo) =>
    nodo.hijas.length === 0 ? [] : [nodo.categoria.code, ...codigosDeRama(nodo.hijas)],
  );
}

/** Lo que el árbol necesita para saber qué ramas están cerradas y cambiarlo. */
export interface ControlDeRamas {
  cerradas: ReadonlySet<string>;
  alternar: (code: string) => void;
  expandirTodo: () => void;
  colapsarTodo: () => void;
}

/**
 * El estado de plegado.
 *
 * Se guarda lo CERRADO y no lo abierto: así una categoría recién creada aparece
 * visible dentro de su rama sin que nadie tenga que abrirla, que es justo lo que
 * se espera después de crearla.
 *
 * **El arranque se calcula UNA sola vez**, con el inicializador perezoso de
 * `useState`. Recalcularlo cuando cambian las raíces —que es un array nuevo en
 * cada render— volvería a cerrar en la siguiente pintada lo que se acabara de
 * abrir, y con la comparación hecha por identidad además dejaría el componente
 * pidiendo un render tras otro sin llegar nunca a asentarse.
 */
export function useRamasCerradas(raices: readonly NodoCategoria[]): ControlDeRamas {
  const [cerradas, setCerradas] = useState<ReadonlySet<string>>(
    () => new Set(raices.flatMap((raiz) => raiz.hijas.map((hija) => hija.categoria.code))),
  );

  return {
    cerradas,
    alternar: (code) =>
      setCerradas((previas) => {
        const siguiente = new Set(previas);
        if (!siguiente.delete(code)) siguiente.add(code);
        return siguiente;
      }),
    expandirTodo: () => setCerradas(new Set()),
    colapsarTodo: () => setCerradas(new Set(codigosDeRama(raices))),
  };
}
