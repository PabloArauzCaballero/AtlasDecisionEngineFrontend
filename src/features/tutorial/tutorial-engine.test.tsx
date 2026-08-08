import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiRequest = vi.hoisted(() => vi.fn().mockResolvedValue([]));
vi.mock('../../api/http-client', () => ({ apiRequest }));

const { InteractiveTutorialProvider } = await import('./InteractiveTutorialProvider');
const { useInteractiveTutorial } = await import('./useInteractiveTutorial');
const { applicableIndex, clampStep, routeForStep } = await import('./tutorial-navigation');
const { TUTORIALS } = await import('./interactive-catalog');

const CACHE_KEY = 'atlas.tutorial.progress';

/** Router falso: registra a dónde se pidió navegar sin montar Next. */
function fakeRouter(pathname: string) {
  return { pathname, push: vi.fn() };
}

function Harness({ id, resume }: { id: string; resume?: boolean }) {
  const { start } = useInteractiveTutorial();
  return (
    <div>
      <button type="button" onClick={() => start(id, { resume })}>
        lanzar
      </button>
      {/* Elementos que el recorrido de bienvenida resalta. */}
      <div data-tutorial-id="dashboard-metrics">métricas</div>
      <nav data-tutorial-id="sidebar-nav">menú</nav>
    </div>
  );
}

function renderEngine(id: string, router = fakeRouter('/platform-health'), resume = false) {
  const view = render(
    <InteractiveTutorialProvider router={router}>
      <Harness id={id} resume={resume} />
    </InteractiveTutorialProvider>,
  );
  return { ...view, router };
}

beforeEach(() => {
  apiRequest.mockClear();
  apiRequest.mockResolvedValue([]);
});

describe('navegación entre rutas', () => {
  it('lleva al usuario a la pantalla del tutorial al lanzarlo desde otra ruta', async () => {
    const router = fakeRouter('/tutorials');
    renderEngine('variables', router);
    fireEvent.click(screen.getByText('lanzar'));

    // `variables` no declara ruta en sus pasos: la hereda de su ficha del Centro.
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/variables'));
  });

  it('no navega si el usuario ya está en la pantalla correcta', async () => {
    const router = fakeRouter('/platform-health');
    renderEngine('welcome', router);
    fireEvent.click(screen.getByText('lanzar'));

    await screen.findByText('ATLAS decide, tú defines cómo');
    expect(router.push).not.toHaveBeenCalled();
  });

  it('sin router el recorrido sigue funcionando, sólo que no cambia de pantalla', async () => {
    render(
      <InteractiveTutorialProvider>
        <Harness id="welcome" />
      </InteractiveTutorialProvider>,
    );
    fireEvent.click(screen.getByText('lanzar'));
    expect(await screen.findByText('ATLAS decide, tú defines cómo')).toBeInTheDocument();
  });

  it('lanzado desde otra ruta NO descarta los pasos opcionales de la vista destino', () => {
    // El DOM de `/tutorials` no dice nada sobre los elementos de `/variables`:
    // filtrar allí borraría justo los pasos que el usuario venía a ver.
    const tutorial = TUTORIALS.variables;
    const optional = tutorial.steps.findIndex((step) => step.optional);
    expect(optional).toBeGreaterThanOrEqual(0);
    // Sin ningún target en el documento, el filtro los saltaría todos…
    expect(applicableIndex(tutorial, optional, 1, '/variables')).not.toBe(optional);
  });
});

describe('reanudar y reiniciar', () => {
  it('«Continuar» retoma el paso guardado en lugar de empezar de cero', async () => {
    window.localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        welcome: { tutorialId: 'welcome', status: 'SKIPPED', lastStep: 2, version: 1 },
      }),
    );
    renderEngine('welcome', fakeRouter('/platform-health'), true);
    fireEvent.click(screen.getByText('lanzar'));

    expect(await screen.findByText(/paso 3 de/)).toBeInTheDocument();
  });

  it('un paso guardado fuera de rango no deja el recorrido en blanco', () => {
    const tutorial = TUTORIALS.welcome;
    expect(clampStep(tutorial, 99)).toBe(tutorial.steps.length - 1);
    expect(clampStep(tutorial, -3)).toBe(0);
    expect(clampStep(tutorial, Number.NaN)).toBe(0);
  });

  it('reiniciar cuenta la repetición y vuelve al primer paso', async () => {
    window.localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        welcome: {
          tutorialId: 'welcome',
          status: 'COMPLETED',
          lastStep: 3,
          version: 1,
          repeatCount: 1,
        },
      }),
    );
    function Repeater() {
      const { start } = useInteractiveTutorial();
      return (
        <button type="button" onClick={() => start('welcome', { repeat: true })}>
          repetir
        </button>
      );
    }
    render(
      <InteractiveTutorialProvider router={fakeRouter('/platform-health')}>
        <Repeater />
      </InteractiveTutorialProvider>,
    );
    fireEvent.click(screen.getByText('repetir'));

    await waitFor(() => {
      const put = apiRequest.mock.calls.find(
        (call) => String(call[0]).includes('welcome') && call[1]?.method === 'PUT',
      );
      expect(put?.[1]?.body?.repeatCount).toBe(2);
      expect(put?.[1]?.body?.lastStep).toBe(0);
    });
  });
});

describe('versión del tutorial', () => {
  it('persiste la versión REAL del recorrido, no un 1 fijo', async () => {
    // Sin esto, un tutorial reescrito jamás se volvía a ofrecer: el progreso
    // guardado decía "versión 1" para todos.
    renderEngine('artifacts', fakeRouter('/artifacts'));
    fireEvent.click(screen.getByText('lanzar'));

    await waitFor(() => {
      const put = apiRequest.mock.calls.find(
        (call) => String(call[0]).includes('artifacts') && call[1]?.method === 'PUT',
      );
      expect(put?.[1]?.body?.version).toBe(TUTORIALS.artifacts.version);
    });
    expect(TUTORIALS.artifacts.version).toBeGreaterThan(1);
  });
});

describe('salida', () => {
  it('salir del primer paso no pregunta: no hay avance que perder', async () => {
    renderEngine('welcome');
    fireEvent.click(screen.getByText('lanzar'));
    await screen.findByText('ATLAS decide, tú defines cómo');

    fireEvent.click(screen.getByLabelText('Salir del tutorial'));
    await waitFor(() =>
      expect(screen.queryByText('ATLAS decide, tú defines cómo')).not.toBeInTheDocument(),
    );
  });

  it('salir a mitad pide confirmación y se puede cancelar', async () => {
    renderEngine('welcome');
    fireEvent.click(screen.getByText('lanzar'));
    fireEvent.click(await screen.findByRole('button', { name: /Siguiente/ }));

    fireEvent.click(screen.getByLabelText('Salir del tutorial'));
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Seguir aquí' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    // El recorrido sigue vivo tras cancelar la salida.
    expect(screen.getByText(/paso 2 de/)).toBeInTheDocument();
  });

  it('confirmar la salida guarda el paso para poder retomarlo', async () => {
    renderEngine('welcome');
    fireEvent.click(screen.getByText('lanzar'));
    fireEvent.click(await screen.findByRole('button', { name: /Siguiente/ }));
    fireEvent.click(screen.getByLabelText('Salir del tutorial'));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, salir' }));

    await waitFor(() => {
      const put = apiRequest.mock.calls.find(
        (call) => String(call[0]).includes('welcome') && call[1]?.body?.status === 'SKIPPED',
      );
      expect(put?.[1]?.body?.lastStep).toBe(1);
    });
  });
});

describe('teclado', () => {
  it('las flechas recorren los pasos y Escape pide la salida', async () => {
    renderEngine('welcome');
    fireEvent.click(screen.getByText('lanzar'));
    await screen.findByText('ATLAS decide, tú defines cómo');

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByText(/paso 2 de/)).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByText(/paso 1 de/)).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
  });

  it('mientras se confirma la salida, las flechas no mueven el paso por debajo', async () => {
    renderEngine('welcome');
    fireEvent.click(screen.getByText('lanzar'));
    fireEvent.click(await screen.findByRole('button', { name: /Siguiente/ }));
    fireEvent.keyDown(window, { key: 'Escape' });
    await screen.findByRole('alertdialog');

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByText(/paso 2 de/)).toBeInTheDocument();
  });
});

describe('herencia de ruta entre pasos', () => {
  it('un paso sin ruta hereda la del anterior que la declare', () => {
    const tutorial = TUTORIALS.welcome;
    expect(routeForStep(tutorial, 0)).toBe('/platform-health');
    // Los pasos siguientes no repiten la ruta y la heredan.
    expect(routeForStep(tutorial, tutorial.steps.length - 1)).toBe('/platform-health');
  });

  it('un recorrido sin rutas no fuerza ninguna navegación', () => {
    expect(routeForStep(TUTORIALS['error:VALIDATION_ERROR'], 0)).toBeNull();
  });
});
