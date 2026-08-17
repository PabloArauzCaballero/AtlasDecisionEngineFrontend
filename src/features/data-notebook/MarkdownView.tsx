import { createElement, Fragment, type ReactNode } from 'react';
import { parseMarkdown, type InlineNode, type MarkdownBlock } from './markdown';

/**
 * Pinta lo que `markdown.ts` entendió, como ELEMENTOS y nunca como HTML.
 *
 * Aquí no hay `dangerouslySetInnerHTML` y no debe haberlo: el texto de un comentario llega a la
 * pantalla como hijo de un elemento de React, que lo escapa. Es lo que permite que estas celdas no
 * necesiten un saneador —y que no haya un saneador que se quede corto cuando alguien pegue algo
 * raro—.
 */

function inline(nodos: InlineNode[]): ReactNode {
  return nodos.map((nodo, indice) => {
    const clave = `${nodo.type}-${indice}`;
    switch (nodo.type) {
      case 'text':
        return <Fragment key={clave}>{nodo.value}</Fragment>;
      case 'strong':
        return <strong key={clave}>{inline(nodo.children)}</strong>;
      case 'em':
        return <em key={clave}>{inline(nodo.children)}</em>;
      case 'code':
        return (
          <code key={clave} className="markdown__code">
            {nodo.value}
          </code>
        );
      case 'link':
        return (
          /*
           * `rel="noreferrer"` va con `target="_blank"` siempre: sin él, la página abierta recibe
           * `window.opener` y puede redirigir la pestaña de origen. En un portal de decisiones eso
           * es una pantalla de acceso falsa a un clic de distancia.
           */
          <a key={clave} href={nodo.href} target="_blank" rel="noreferrer">
            {inline(nodo.children)}
          </a>
        );
    }
  });
}

function bloque(nodo: MarkdownBlock, indice: number): ReactNode {
  const clave = `${nodo.type}-${indice}`;
  switch (nodo.type) {
    case 'heading':
      return createElement(`h${nodo.level}`, { key: clave }, inline(nodo.children));
    case 'paragraph':
      return <p key={clave}>{inline(nodo.children)}</p>;
    case 'code':
      return (
        <pre key={clave} className="markdown__block">
          <code>{nodo.value}</code>
        </pre>
      );
    case 'quote':
      return <blockquote key={clave}>{inline(nodo.children)}</blockquote>;
    case 'rule':
      return <hr key={clave} />;
    case 'list':
      return createElement(
        nodo.ordered ? 'ol' : 'ul',
        { key: clave },
        nodo.items.map((item, posicion) => <li key={`${clave}-${posicion}`}>{inline(item)}</li>),
      );
  }
}

export function MarkdownView({ source }: { source: string }) {
  const bloques = parseMarkdown(source);

  if (!bloques.length) {
    return (
      <p className="markdown markdown--vacio">
        Comentario vacío. Escribe aquí lo que este tramo del análisis significa.
      </p>
    );
  }

  return <div className="markdown">{bloques.map(bloque)}</div>;
}
