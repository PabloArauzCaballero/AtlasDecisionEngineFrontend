'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, CircleSlash, Pencil, Plus } from 'lucide-react';
import type { SemanticCategory } from './categories.api';

/**
 * El árbol, como árbol y PLEGABLE.
 *
 * Cincuenta categorías en una lista plana no son un árbol: son un muro. Se
 * abre y se cierra por rama porque la pregunta que trae aquí a alguien es
 * siempre local —«¿qué hay bajo Gastos › Vivienda?»— y para responderla no hace
 * falta ver Ingresos.
 *
 * **Arranca con las raíces abiertas y el resto cerrado.** Todo abierto devuelve
 * el muro; todo cerrado obliga a un clic para ver que existe algo. Las dos
 * raíces abiertas enseñan la forma del catálogo en una pantalla.
 *
 * Las ramas se distinguen de las hojas porque **la clasificación recae en las
 * hojas**: una rama lleva umbral 1 y no puede ganar nunca, y verlo evita la
 * pregunta de por qué «Vivienda» no sale jamás en un resultado.
 */

export interface CategoryTreeProps {
  categorias: readonly SemanticCategory[];
  onEditar: (categoria: SemanticCategory) => void;
  onDesactivar: (categoria: SemanticCategory) => void;
  onAgregarHija: (parentCode: string) => void;
}

interface Nodo {
  categoria: SemanticCategory;
  hijas: Nodo[];
  /** Hojas que cuelgan de aquí, a cualquier profundidad. */
  hojas: number;
}

/**
 * Arma el árbol. Una categoría cuyo padre no está en la lista se cuelga de la
 * raíz en vez de desaparecer: un catálogo con una referencia rota se tiene que
 * PODER VER para arreglarlo, y esconderla dejaría a alguien buscando una fila
 * que la API sí devuelve.
 */
function armar(categorias: readonly SemanticCategory[]): Nodo[] {
  const porCodigo = new Map(
    categorias.map((c) => [c.code, { categoria: c, hijas: [], hojas: 0 } as Nodo]),
  );
  const raices: Nodo[] = [];
  for (const nodo of porCodigo.values()) {
    const padre = nodo.categoria.parentCode;
    const nodoPadre = padre === null ? undefined : porCodigo.get(padre);
    if (nodoPadre === undefined) raices.push(nodo);
    else nodoPadre.hijas.push(nodo);
  }
  const preparar = (nodos: Nodo[]): Nodo[] =>
    nodos
      .sort((a, b) => a.categoria.code.localeCompare(b.categoria.code))
      .map((nodo) => {
        const hijas = preparar(nodo.hijas);
        const hojas = hijas.length === 0 ? 1 : hijas.reduce((total, hija) => total + hija.hojas, 0);
        return { ...nodo, hijas, hojas };
      });
  return preparar(raices);
}

export function CategoryTree({
  categorias,
  onEditar,
  onDesactivar,
  onAgregarHija,
}: CategoryTreeProps) {
  const raices = armar(categorias);
  /*
   * Se guarda lo CERRADO y no lo abierto: así una categoría recién creada
   * aparece visible dentro de su rama sin que nadie tenga que abrirla, que es
   * justo lo que se espera después de crearla.
   */
  const [cerradas, setCerradas] = useState<ReadonlySet<string>>(
    () => new Set(raices.flatMap((raiz) => raiz.hijas.map((hija) => hija.categoria.code))),
  );

  const alternar = (code: string) =>
    setCerradas((previas) => {
      const siguiente = new Set(previas);
      if (!siguiente.delete(code)) siguiente.add(code);
      return siguiente;
    });

  if (raices.length === 0) {
    return <p className="categoria-vacio">Este tenant todavía no tiene categorías sembradas.</p>;
  }
  return (
    <ul className="categoria-arbol" aria-label="Árbol de categorías">
      {raices.map((nodo) => (
        <Rama
          key={nodo.categoria.code}
          nodo={nodo}
          nivel={0}
          cerradas={cerradas}
          onAlternar={alternar}
          onEditar={onEditar}
          onDesactivar={onDesactivar}
          onAgregarHija={onAgregarHija}
        />
      ))}
    </ul>
  );
}

function Rama({
  nodo,
  nivel,
  cerradas,
  onAlternar,
  onEditar,
  onDesactivar,
  onAgregarHija,
}: {
  nodo: Nodo;
  nivel: number;
  cerradas: ReadonlySet<string>;
  onAlternar: (code: string) => void;
} & Omit<CategoryTreeProps, 'categorias'>) {
  const { categoria, hijas } = nodo;
  const esRama = hijas.length > 0;
  const abierta = esRama && !cerradas.has(categoria.code);

  return (
    /*
     * El NIVEL vive en el nodo, no en la fila, y esa mudanza arregla un defecto
     * visible: la guía vertical de una rama la dibuja el `<ul>` de sus hijas, que
     * es hermano de la fila y por tanto no podía leer una variable declarada en
     * ella. Todas las guías se dibujaban en la misma abscisa, así que a partir
     * del segundo nivel la línea ya no señalaba a su propia rama —y una guía que
     * no coincide con su rama es peor que ninguna: dice algo falso—. Declarado en
     * el `<li>` lo heredan los dos, cada uno con el suyo.
     */
    <li
      className={`categoria-nodo${esRama ? ' es-rama' : ' es-hoja'}`}
      style={{ '--nivel': nivel } as React.CSSProperties}
    >
      <div className={`categoria-fila${categoria.isActive ? '' : ' is-inactive'}`}>
        {/*
         * El botón envuelve el código porque el objetivo de pulsación de un
         * triángulo de doce píxeles es una trampa: pulsar el nombre de la rama
         * es lo que cualquiera intenta primero.
         */}
        {esRama ? (
          <button
            type="button"
            className="categoria-desplegar"
            aria-expanded={abierta}
            onClick={() => onAlternar(categoria.code)}
          >
            {abierta ? (
              <ChevronDown size={14} aria-hidden="true" />
            ) : (
              <ChevronRight size={14} aria-hidden="true" />
            )}
            <code>{categoria.code}</code>
            <span className="categoria-nombre">{categoria.name}</span>
          </button>
        ) : (
          <span className="categoria-desplegar is-hoja">
            <code>{categoria.code}</code>
            <span className="categoria-nombre">{categoria.name}</span>
          </span>
        )}

        <div className="categoria-señales">
          {esRama ? (
            <span
              className="categoria-etiqueta"
              title="Agrupa; la clasificación recae en sus hojas"
            >
              {nodo.hojas} hoja{nodo.hojas === 1 ? '' : 's'}
            </span>
          ) : (
            <>
              <span className="categoria-umbral" title="Umbral de aceptación">
                {categoria.acceptanceThreshold.toFixed(2)}
              </span>
              <span className="categoria-cuenta">
                {categoria.positiveExamples.length} ej · {categoria.counterExamples.length} contra
              </span>
            </>
          )}
          {!categoria.isActive ? (
            <span className="categoria-etiqueta es-inactiva">inactiva</span>
          ) : null}
        </div>

        <div className="categoria-acciones">
          <button
            type="button"
            className="button"
            onClick={() => onAgregarHija(categoria.code)}
            aria-label={`Añadir una categoría dentro de ${categoria.code}`}
            title="Añadir una categoría dentro de ésta"
          >
            <Plus size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="button"
            onClick={() => onEditar(categoria)}
            aria-label={`Editar ${categoria.code}`}
            title="Editar"
          >
            <Pencil size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="button"
            onClick={() => onDesactivar(categoria)}
            disabled={!categoria.isActive}
            aria-label={`Desactivar ${categoria.code}`}
            title="Desactivar: sale del catálogo pero la traza que la cita sigue siendo legible"
          >
            <CircleSlash size={14} aria-hidden="true" />
          </button>
        </div>
      </div>

      {abierta ? (
        <ul>
          {hijas.map((hija) => (
            <Rama
              key={hija.categoria.code}
              nodo={hija}
              nivel={nivel + 1}
              cerradas={cerradas}
              onAlternar={onAlternar}
              onEditar={onEditar}
              onDesactivar={onDesactivar}
              onAgregarHija={onAgregarHija}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
