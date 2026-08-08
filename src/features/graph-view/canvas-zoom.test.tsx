import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useCanvasZoom, ZOOM_MAX, ZOOM_MIN, type CanvasSize } from './useCanvasZoom';
import { ZoomControls } from './ZoomControls';

/**
 * La escala es lo único que separa «ver el algoritmo» de «adivinar por dónde va» en un
 * grafo que no cabe en la pantalla, así que sus límites y su ajuste se fijan aquí.
 */
function Harness({ content }: { content?: CanvasSize }) {
  const zoom = useCanvasZoom({ content });
  return (
    <div>
      <ZoomControls zoom={zoom} />
      <div className="graph-canvas-viewport" data-testid="viewport" ref={zoom.viewportRef} />
    </div>
  );
}

/** jsdom no hace diseño: la ventana visible se declara para poder probar «Ajustar». */
function sizeViewport(width: number, height: number) {
  const viewport = screen.getByTestId('viewport');
  Object.defineProperty(viewport, 'clientWidth', { value: width, configurable: true });
  Object.defineProperty(viewport, 'clientHeight', { value: height, configurable: true });
  viewport.scrollTo = () => {};
}

const percent = () => screen.getByRole('button', { name: /Escala .* por ciento/ });

describe('escala de un lienzo de grafo', () => {
  it('acerca y aleja en pasos legibles', () => {
    render(<Harness />);
    expect(percent()).toHaveTextContent('100%');
    fireEvent.click(screen.getByRole('button', { name: 'Alejar' }));
    expect(percent()).toHaveTextContent('90%');
    fireEvent.click(screen.getByRole('button', { name: 'Acercar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Acercar' }));
    expect(percent()).toHaveTextContent('110%');
  });

  it('el porcentaje es el botón que devuelve al 100 %', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Alejar' }));
    fireEvent.click(percent());
    expect(percent()).toHaveTextContent('100%');
  });

  it('no se puede pasar de los límites, y el botón lo dice', () => {
    render(<Harness />);
    const out = screen.getByRole('button', { name: 'Alejar' });
    // Alejar hasta el tope: el botón se desactiva en vez de dejar seguir hasta 0.
    for (let step = 0; step < 40; step += 1) fireEvent.click(out);
    expect(percent()).toHaveTextContent(`${Math.round(ZOOM_MIN * 100)}%`);
    expect(out).toBeDisabled();

    const zoomIn = screen.getByRole('button', { name: 'Acercar' });
    for (let step = 0; step < 60; step += 1) fireEvent.click(zoomIn);
    expect(percent()).toHaveTextContent(`${Math.round(ZOOM_MAX * 100)}%`);
    expect(zoomIn).toBeDisabled();
  });

  it('«Ajustar» elige la escala a la que el grafo entero cabe', () => {
    // Mundo de 2000×1000 en una ventana de 1024×768 (menos el margen de 24): manda el
    // ancho, que es el eje que se queda corto.
    render(<Harness content={{ width: 2_000, height: 1_000 }} />);
    sizeViewport(1_024, 768);
    fireEvent.click(screen.getByRole('button', { name: 'Ajustar el grafo a la ventana' }));
    expect(percent()).toHaveTextContent('50%');
  });

  it('«Ajustar» no amplía por encima del máximo con un grafo diminuto', () => {
    render(<Harness content={{ width: 100, height: 50 }} />);
    sizeViewport(1_024, 768);
    fireEvent.click(screen.getByRole('button', { name: 'Ajustar el grafo a la ventana' }));
    expect(percent()).toHaveTextContent(`${Math.round(ZOOM_MAX * 100)}%`);
  });

  it('Ctrl + rueda cambia la escala y la rueda sola no', () => {
    render(<Harness content={{ width: 1_000, height: 1_000 }} />);
    const viewport = screen.getByTestId('viewport');

    fireEvent.wheel(viewport, { deltaY: -100 });
    expect(percent()).toHaveTextContent('100%');

    fireEvent.wheel(viewport, { deltaY: -100, ctrlKey: true });
    expect(percent()).toHaveTextContent('110%');
    fireEvent.wheel(viewport, { deltaY: 100, ctrlKey: true });
    expect(percent()).toHaveTextContent('100%');
  });
});
