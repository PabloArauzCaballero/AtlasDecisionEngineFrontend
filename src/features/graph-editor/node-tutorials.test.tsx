import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NODE_CATALOG } from './node-catalog';
import { NODE_TUTORIALS, tutorialFor } from './node-tutorials';
import { NodeTypeTutorial } from './NodeTypeTutorial';

/**
 * La guía por tipo existe porque los campos del panel piden piezas cuyo origen no
 * era evidente: qué variable compara una condición, de dónde sale el algoritmo de
 * una referencia, qué habilita una función de librería.
 */
describe('guía por tipo de nodo', () => {
  it('cubre TODOS los tipos del catálogo', () => {
    // Un tipo nuevo sin guía dejaría al usuario sin explicación justo donde más
    // falta hace, y el fallo sería invisible: el botón simplemente no aparece.
    const sinGuia = Object.keys(NODE_CATALOG).filter((type) => !tutorialFor(type));
    expect(sinGuia).toEqual([]);
  });

  it('no declara guías para tipos que no existen en el catálogo', () => {
    const sobrantes = Object.keys(NODE_TUTORIALS).filter((type) => !(type in NODE_CATALOG));
    expect(sobrantes).toEqual([]);
  });

  it('empieza cerrada y se abre con el botón', () => {
    render(<NodeTypeTutorial nodeType="CONDITION" />);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Cómo se configura/ }));
    expect(screen.getByRole('list')).toBeInTheDocument();
  });

  it('explica de dónde salen las condiciones en los nodos que las usan', () => {
    render(<NodeTypeTutorial nodeType="CONDITION" />);
    fireEvent.click(screen.getByRole('button', { name: /Cómo se configura/ }));
    expect(screen.getByText(/pertenecen a este algoritmo/)).toBeInTheDocument();
    expect(screen.getByText(/Entradas · Variables a considerar/)).toBeInTheDocument();
  });

  it('no habla de condiciones en un tipo que no las usa', () => {
    render(<NodeTypeTutorial nodeType="RESULT" />);
    fireEvent.click(screen.getByRole('button', { name: /Cómo se configura/ }));
    expect(screen.queryByText(/pertenecen a este algoritmo/)).not.toBeInTheDocument();
  });

  it('no rompe con un tipo desconocido', () => {
    const { container } = render(<NodeTypeTutorial nodeType="INVENTADO" />);
    expect(container).toBeEmptyDOMElement();
  });
});
