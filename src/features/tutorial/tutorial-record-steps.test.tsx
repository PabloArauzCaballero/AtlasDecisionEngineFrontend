import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiRequest = vi.hoisted(() => vi.fn().mockResolvedValue([]));
vi.mock('../../api/http-client', () => ({ apiRequest }));

const { InteractiveTutorialProvider } = await import('./InteractiveTutorialProvider');
const { routeForStep, isAtRoute } = await import('./tutorial-navigation');
const { TUTORIALS } = await import('./interactive-catalog');
const { useInteractiveTutorial } = await import('./useInteractiveTutorial');

beforeEach(() => {
  apiRequest.mockClear();
  apiRequest.mockResolvedValue([]);
});

describe('recorridos de ficha: el motor lleva hasta el registro', () => {
  it('el primer paso pide abrir una fila del listado', () => {
    for (const id of ['artifact-detail', 'execution-detail', 'manual-review', 'objective-detail']) {
      const first = TUTORIALS[id].steps[0];
      expect(first.id, id).toBe('open-record');
      expect(first.requiredAction, id).toBe('click');
      expect(first.target, id).toBe('[data-tutorial-id="resource-table"]');
      // Opcional: un listado vacío no puede dejar el recorrido esperando.
      expect(first.optional, id).toBe(true);
    }
  });

  it('el paso de apertura vive en el LISTADO, no en la ficha', () => {
    expect(routeForStep(TUTORIALS['artifact-detail'], 0)).toBe('/artifacts');
    expect(routeForStep(TUTORIALS['execution-detail'], 0)).toBe('/executions');
    expect(routeForStep(TUTORIALS['manual-review'], 0)).toBe('/manual-reviews');
    expect(routeForStep(TUTORIALS['objective-detail'], 0)).toBe('/objectives');
  });

  it('a partir de la ficha el recorrido NO vuelve a navegar', () => {
    // La ruta de la ficha es `/artifacts/{id}`: el motor no puede construirla.
    // Sin cortar la herencia, cada paso devolvería a la persona al listado.
    const tutorial = TUTORIALS['artifact-detail'];
    for (let i = 1; i < tutorial.steps.length; i += 1) {
      expect(routeForStep(tutorial, i), `paso ${i}`).toBeNull();
    }
  });

  it('abrir una ficha NO devuelve al listado', async () => {
    // Regresión: al pulsar "Ver detalle" la ruta cambia antes de que el paso
    // avance, así que el efecto de navegación corría todavía con el paso del
    // listado y empujaba de vuelta —justo al entrar—, dejando el recorrido en
    // un bucle. Estar en `/artifacts/row-1` ES estar en `/artifacts`.
    expect(isAtRoute('/artifacts/row-1', '/artifacts')).toBe(true);
    expect(isAtRoute('/artifacts', '/artifacts')).toBe(true);
    // Pero no vale cualquier prefijo de texto: `/artifacts-nuevo` es otra vista.
    expect(isAtRoute('/artifacts-nuevo', '/artifacts')).toBe(false);
    expect(isAtRoute('/executions', '/artifacts')).toBe(false);
    expect(isAtRoute(undefined, '/artifacts')).toBe(false);

    const push = vi.fn();
    function Launch() {
      const { start } = useInteractiveTutorial();
      return (
        <button type="button" onClick={() => start('artifact-detail')}>
          lanzar
        </button>
      );
    }
    // Ya dentro de la ficha: el motor no debe empujar a ninguna parte.
    render(
      <InteractiveTutorialProvider router={{ pathname: '/artifacts/row-1', push }}>
        <Launch />
      </InteractiveTutorialProvider>,
    );
    fireEvent.click(screen.getByText('lanzar'));
    await waitFor(() => expect(screen.getByText(/paso 1 de/)).toBeInTheDocument());
    expect(push).not.toHaveBeenCalled();
  });

  it('escucha la acción aunque el elemento aparezca DESPUÉS de mostrar el paso', async () => {
    // Regresión: el escucha se enganchaba una sola vez, al mostrar el paso. Un
    // paso que pide pulsar algo que llega después —tras navegar, o tras la
    // respuesta del backend— se quedaba sordo, y el recorrido no avanzaba por
    // mucho que la persona pulsara lo resaltado.
    function LateTarget() {
      const { start } = useInteractiveTutorial();
      const [visible, setVisible] = useState(false);
      return (
        <div>
          <button type="button" onClick={() => start('artifact-detail')}>
            lanzar
          </button>
          <button type="button" onClick={() => setVisible(true)}>
            montar tabla
          </button>
          {visible ? <table data-tutorial-id="resource-table" /> : null}
        </div>
      );
    }
    // Lanzado desde el Centro, como en la vida real: al mostrarse el paso, la
    // tabla del listado todavía no existe porque no se ha navegado.
    render(
      <InteractiveTutorialProvider router={{ pathname: '/tutorials', push: vi.fn() }}>
        <LateTarget />
      </InteractiveTutorialProvider>,
    );

    fireEvent.click(screen.getByText('lanzar'));
    await screen.findByText('Abre un artefacto');

    // La tabla llega tarde, como tras una navegación.
    fireEvent.click(screen.getByText('montar tabla'));
    const table = await screen.findByRole('table');
    await waitFor(() => expect(screen.getByText(/Haz clic en lo resaltado/)).toBeInTheDocument());

    fireEvent.click(table);
    // El clic real sobre el objetivo tardío avanza el recorrido.
    await waitFor(() => expect(screen.queryByText('Abre un artefacto')).not.toBeInTheDocument());
  });

  it('subieron de versión, así que quien ya los hizo vuelve a verlos ofrecidos', () => {
    for (const id of ['artifact-detail', 'execution-detail', 'manual-review', 'objective-detail']) {
      expect(TUTORIALS[id].version, id).toBeGreaterThan(1);
    }
  });
});
