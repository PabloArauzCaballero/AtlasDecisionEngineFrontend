'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

interface EditorSectionProps {
  id: string;
  title: string;
  /** Una frase: qué se hace aquí y por qué importa. */
  hint: string;
  /** Estado plegado, en datos: «3 entradas · 2 salidas · contrato incompleto». */
  summary: string;
  /** Marca ámbar cuando falta algo que el resumen ya nombra. */
  attention?: boolean;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

/**
 * Sección plegable del editor.
 *
 * El editor apilaba en vertical los cinco paneles de datos y los tres de
 * análisis SIEMPRE desplegados. Medido en una ventana de 1440×900: el lienzo
 * —lo único que esta pantalla existe para manipular— empezaba en y≈1380, es
 * decir, año y medio de scroll por debajo del pliegue. Se entraba al editor de
 * grafo y no se veía el grafo.
 *
 * Plegadas, cada sección ocupa una fila y dice en su resumen lo que contiene,
 * así que no hay que abrirla para saber si hace falta. El lienzo sube a la
 * primera pantalla y los datos siguen a un clic.
 */
export function EditorSection(props: EditorSectionProps) {
  const panelId = `editor-section-${props.id}`;
  return (
    <section className={`editor-section${props.open ? ' is-open' : ''}`}>
      <h2>
        <button
          type="button"
          aria-expanded={props.open}
          aria-controls={panelId}
          onClick={props.onToggle}
        >
          {props.open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          <strong>{props.title}</strong>
          <small>{props.hint}</small>
          <span
            className={props.attention ? 'editor-section-summary warn' : 'editor-section-summary'}
          >
            {props.summary}
          </span>
        </button>
      </h2>
      {/* Se desmonta al plegar a propósito: estos paneles montan selectores que
          consultan el catálogo, y dejarlos vivos detrás de un `display: none`
          mantenía peticiones y foco en algo que nadie ve. */}
      {props.open ? <div id={panelId}>{props.children}</div> : null}
    </section>
  );
}
