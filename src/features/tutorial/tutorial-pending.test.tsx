import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiRequest = vi.hoisted(() => vi.fn().mockResolvedValue([]));
vi.mock('../../api/http-client', () => ({ apiRequest }));

const { InteractiveTutorialProvider } = await import('./InteractiveTutorialProvider');
const { TutorialWelcomePrompt } = await import('./TutorialWelcomePrompt');
const { memoryAnalytics, safeAnalytics } = await import('./tutorial-analytics');
const { parseProgressMap, parseProgressRows } = await import('./tutorial-progress.schema');
const { TUTORIALS } = await import('./interactive-catalog');
const { useInteractiveTutorial } = await import('./useInteractiveTutorial');

const CACHE_KEY = 'atlas.tutorial.progress';

beforeEach(() => {
  apiRequest.mockClear();
  apiRequest.mockResolvedValue([]);
});

describe('validación del progreso en la frontera', () => {
  it('descarta filas corruptas en vez de propagarlas al Centro', () => {
    const map = parseProgressRows([
      { tutorialId: 'ok', status: 'COMPLETED', lastStep: 2, version: 2, autoShow: true },
      { tutorialId: 'sin-estado', lastStep: 1 },
      { status: 'STARTED', lastStep: 1 },
      'basura',
      null,
    ]);
    expect(Object.keys(map)).toEqual(['ok']);
  });

  it('un campo numérico inválido cae a un valor sano, no a NaN', () => {
    const map = parseProgressRows([
      { tutorialId: 'x', status: 'STARTED', lastStep: 'tres', version: -4, autoShow: 'sí' },
    ]);
    expect(map.x.lastStep).toBe(0);
    expect(map.x.version).toBe(1);
    expect(map.x.autoShow).toBe(true);
    expect(Number.isNaN(map.x.lastStep)).toBe(false);
  });

  it('una caché de una versión anterior del portal no rompe la carga', () => {
    expect(parseProgressMap({ viejo: { tutorialId: 'viejo', estado: 'HECHO' } })).toEqual({});
    expect(parseProgressMap(null)).toEqual({});
    expect(parseProgressMap([1, 2])).toEqual({});
  });

  it('el hook ignora una respuesta con forma inesperada del backend', async () => {
    apiRequest.mockResolvedValue({ items: [] });
    function Probe() {
      useInteractiveTutorial();
      return <p>listo</p>;
    }
    render(
      <InteractiveTutorialProvider>
        <Probe />
      </InteractiveTutorialProvider>,
    );
    // No revienta: la vista sigue en pie con la caché local.
    expect(await screen.findByText('listo')).toBeInTheDocument();
  });
});

describe('analítica', () => {
  function Launcher() {
    const { start, next, exit } = useInteractiveTutorial();
    return (
      <div>
        <button type="button" onClick={() => start('welcome')}>
          lanzar
        </button>
        <button type="button" onClick={next}>
          avanzar
        </button>
        <button type="button" onClick={exit}>
          salir
        </button>
      </div>
    );
  }

  it('emite inicio, cada paso visto y el abandono con su paso', async () => {
    const analytics = memoryAnalytics();
    render(
      <InteractiveTutorialProvider
        router={{ pathname: '/platform-health', push: vi.fn() }}
        analytics={analytics}
      >
        <Launcher />
      </InteractiveTutorialProvider>,
    );

    fireEvent.click(screen.getByText('lanzar'));
    await waitFor(() => expect(analytics.events[0]?.type).toBe('started'));
    fireEvent.click(screen.getByText('avanzar'));
    fireEvent.click(screen.getByText('salir'));

    const types = analytics.events.map((event) => event.type);
    expect(types[0]).toBe('started');
    expect(types).toContain('step');
    expect(types.at(-1)).toBe('abandoned');

    // El abandono dice EN QUÉ paso se fue: `lastStep` no distingue una pausa.
    // Se compara con el último paso VISTO en vez de con un índice fijo: avanzar
    // puede saltarse un paso opcional cuyo elemento no está en pantalla, y
    // clavar el número aquí haría fallar la prueba por un cambio de catálogo.
    const lastStep = analytics.events.filter((event) => event.type === 'step').at(-1);
    const abandoned = analytics.events.at(-1);
    expect(abandoned).toMatchObject({
      type: 'abandoned',
      index: (lastStep as { index: number }).index,
      stepId: (lastStep as { stepId: string }).stepId,
    });
  });

  it('emite "completed" al terminar el último paso', async () => {
    const analytics = memoryAnalytics();
    function Finisher() {
      const { start, next } = useInteractiveTutorial();
      return (
        <div>
          <button type="button" onClick={() => start('error:VALIDATION_ERROR')}>
            lanzar
          </button>
          <button type="button" onClick={next}>
            avanzar
          </button>
        </div>
      );
    }
    render(
      <InteractiveTutorialProvider analytics={analytics}>
        <Finisher />
      </InteractiveTutorialProvider>,
    );

    fireEvent.click(screen.getByText('lanzar'));
    const total = TUTORIALS['error:VALIDATION_ERROR'].steps.length;
    for (let i = 0; i < total; i += 1) fireEvent.click(screen.getByText('avanzar'));

    await waitFor(() =>
      expect(analytics.events.some((event) => event.type === 'completed')).toBe(true),
    );
  });

  it('un adaptador que falla no tumba el recorrido', () => {
    const explosive = {
      track: () => {
        throw new Error('el destino de analítica está caído');
      },
    };
    // Medir es accesorio; aprender no.
    expect(() =>
      safeAnalytics(explosive).track({ type: 'completed', tutorialId: 'x', version: 1 }),
    ).not.toThrow();
  });
});

describe('invitación al recorrido introductorio', () => {
  function renderPrompt(active = true) {
    return render(
      <InteractiveTutorialProvider router={{ pathname: '/platform-health', push: vi.fn() }}>
        <TutorialWelcomePrompt active={active} />
      </InteractiveTutorialProvider>,
    );
  }

  it('se ofrece a quien nunca ha hecho el recorrido', async () => {
    renderPrompt();
    expect(await screen.findByText('¿Primera vez por aquí?')).toBeInTheDocument();
  });

  it('no aparece fuera de la pantalla de entrada', () => {
    renderPrompt(false);
    expect(screen.queryByText('¿Primera vez por aquí?')).not.toBeInTheDocument();
  });

  it('no se ofrece a quien ya lo completó', async () => {
    window.localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        welcome: {
          tutorialId: 'welcome',
          status: 'COMPLETED',
          lastStep: 3,
          version: 1,
          autoShow: true,
        },
      }),
    );
    renderPrompt();
    await waitFor(() =>
      expect(screen.queryByText('¿Primera vez por aquí?')).not.toBeInTheDocument(),
    );
  });

  it('«No volver a mostrar» lo persiste y lo retira', async () => {
    renderPrompt();
    fireEvent.click(await screen.findByText('No volver a mostrar'));

    expect(screen.queryByText('¿Primera vez por aquí?')).not.toBeInTheDocument();
    await waitFor(() => {
      const put = apiRequest.mock.calls.find(
        (call) => String(call[0]).includes('welcome') && call[1]?.method === 'PUT',
      );
      expect(put?.[1]?.body?.autoShow).toBe(false);
    });
  });

  it('«Ahora no» sólo la cierra: no marca nada como saltado', async () => {
    renderPrompt();
    fireEvent.click(await screen.findByText('Ahora no'));

    expect(screen.queryByText('¿Primera vez por aquí?')).not.toBeInTheDocument();
    const skipped = apiRequest.mock.calls.some((call) => call[1]?.body?.status === 'SKIPPED');
    expect(skipped).toBe(false);
  });

  it('respeta un "no volver a mostrar" guardado antes', async () => {
    window.localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        welcome: {
          tutorialId: 'welcome',
          status: 'STARTED',
          lastStep: 0,
          version: 1,
          autoShow: false,
        },
      }),
    );
    renderPrompt();
    await waitFor(() =>
      expect(screen.queryByText('¿Primera vez por aquí?')).not.toBeInTheDocument(),
    );
  });

  it('al arrancar el recorrido la invitación se aparta', async () => {
    renderPrompt();
    fireEvent.click(await screen.findByText('Hacer el recorrido'));

    await waitFor(() =>
      expect(screen.queryByText('¿Primera vez por aquí?')).not.toBeInTheDocument(),
    );
    expect(screen.getByText('ATLAS decide, tú defines cómo')).toBeInTheDocument();
  });
});
