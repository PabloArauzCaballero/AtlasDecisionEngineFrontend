import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { apiRequest } from '../api/http-client';
import { QaLabPage } from './QaLabPage';
import { abrirOpciones, cerrarOpciones, valorDe } from '../test/option-select';

/**
 * Lo que se fija aquí es el ciclo de una corrida ASÍNCRONA y el catálogo de semillas.
 *
 * El `POST` responde 202 con la corrida en `RUNNING` porque el motor corta toda petición
 * HTTP a los 15 s y doscientos casos no caben ahí —«Request exceeded 15000 ms»—. Esperar
 * la respuesta ya no es esperar el resultado, así que la pantalla tiene que preguntar
 * hasta que la corrida cierre. Si alguien vuelve a leer la respuesta del `POST` como si
 * fuera el informe, estas pruebas se ponen rojas.
 */
const notify = vi.fn();

vi.mock('../api/http-client', () => ({ apiRequest: vi.fn() }));
vi.mock('../notifications/useNotifications', () => ({
  useNotifications: () => ({ notify }),
}));

const mockedApiRequest = vi.mocked(apiRequest);

const HISTORIAL = {
  items: [
    {
      id: '900',
      environmentCode: 'DEV',
      status: 'COMPLETED',
      seed: 'k3f2m1a',
      totalCases: 12,
      failedCases: 0,
      counterexamples: 0,
      startedAt: '2026-08-01T10:00:00.000Z',
    },
  ],
};

const EN_MARCHA = {
  id: '901',
  status: 'RUNNING',
  seed: 'qa-base',
  totalCases: 40,
  plannedCases: 200,
  passedCases: 40,
  failedCases: 0,
  counterexamples: [],
};

const TERMINADA = {
  ...EN_MARCHA,
  status: 'COMPLETED',
  totalCases: 200,
  passedCases: 198,
  failedCases: 2,
};

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <QaLabPage initialVersionId="4001" />
    </QueryClientProvider>,
  );
}

/** Deja la versión elegida: sin eso no se pinta el formulario de configuración. */
async function elegirVersion() {
  fireEvent.click(await screen.findByRole('button', { name: 'Usar esta versión' }));
}

describe('QaLabPage', () => {
  beforeEach(() => {
    notify.mockReset();
    mockedApiRequest.mockReset();
  });

  it('la semilla es un desplegable con catálogo, no un campo libre', async () => {
    mockedApiRequest.mockImplementation(async (path) => {
      if (path.startsWith('/v1/qa-lab/runs?')) return HISTORIAL;
      if (path.includes('/outcomes')) return { items: [] };
      return {};
    });
    renderPage();
    await elegirVersion();

    const semilla = await screen.findByRole('combobox', { name: /^Semilla/ });
    const filas = () => {
      const ids = abrirOpciones(semilla).map((fila) => fila.getAttribute('data-testid'));
      cerrarOpciones(semilla);
      return ids;
    };
    // El catálogo, y además la semilla de la corrida que ya está en el historial.
    expect(filas()).toEqual(
      expect.arrayContaining([
        'select-semilla-option-qa-base',
        'select-semilla-option-qa-regresion',
      ]),
    );
    await waitFor(() => expect(filas()).toContain('select-semilla-option-k3f2m1a'));
    // Y la opción por omisión sigue siendo dejársela al motor.
    expect(valorDe(semilla)).toBe('');
  });

  it('lanza la corrida y la sigue hasta que cierra, sin esperar al POST', async () => {
    let consultas = 0;
    mockedApiRequest.mockImplementation(async (path, options) => {
      if (path.startsWith('/v1/qa-lab/runs?')) return HISTORIAL;
      if (path.includes('/outcomes')) return { items: [] };
      if (options?.method === 'POST') return EN_MARCHA;
      if (path === '/v1/qa-lab/runs/901') {
        consultas += 1;
        // La primera consulta la pilla trabajando; la segunda, ya cerrada.
        return consultas === 1 ? EN_MARCHA : TERMINADA;
      }
      return {};
    });
    renderPage();
    await elegirVersion();

    fireEvent.click(await screen.findByRole('button', { name: /Generar 200 casos/ }));

    // Mientras vive, la pantalla dice cuánto lleva hecho en vez de fingir que terminó.
    expect(await screen.findByText(/40 de 200 casos ejecutados/)).toBeTruthy();

    // Y el aviso de desenlace llega cuando la corrida cierra DE VERDAD, no al responder
    // el POST: con 202 en la mano todavía no hay ningún caso ejecutado que contar.
    await waitFor(
      () =>
        expect(notify).toHaveBeenCalledWith(
          expect.objectContaining({ title: 'Corrida terminada: 198/200 casos correctos' }),
        ),
      { timeout: 5000 },
    );
  });

  it('abrir una corrida del historial no anuncia que acaba de terminar', async () => {
    mockedApiRequest.mockImplementation(async (path) => {
      if (path.startsWith('/v1/qa-lab/runs?')) return HISTORIAL;
      if (path.includes('/outcomes')) return { items: [] };
      if (path === '/v1/qa-lab/runs/900') return { ...TERMINADA, id: '900' };
      return {};
    });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Ver resultado/ }));
    await waitFor(() => expect(screen.getByText(/^Contraejemplos/)).toBeTruthy());
    // Terminó hace días: avisar de su desenlace ahora sería un aviso falso.
    expect(notify).not.toHaveBeenCalled();
  });

  it('«Reproducir» devuelve al formulario la configuración archivada, no sólo la semilla', async () => {
    mockedApiRequest.mockImplementation(async (path, options) => {
      if (path.startsWith('/v1/qa-lab/runs?')) return HISTORIAL;
      if (path.includes('/outcomes')) return { items: [] };
      if (options?.method === 'POST') return EN_MARCHA;
      if (path === '/v1/qa-lab/runs/900') {
        return {
          ...TERMINADA,
          id: '900',
          seed: 'k3f2m1a',
          artifactVersionId: '4001',
          config: {
            caseCount: 37,
            mix: { validPercent: 50, boundaryPercent: 30, invalidPercent: 20 },
            concurrency: 3,
            timeoutMs: 30_000,
            checkDeterminism: true,
            coverOutcomes: false,
            distributions: { edad: { shape: 'LOW_TAIL' } },
          },
        };
      }
      return {};
    });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /^Reproducir$/ }));
    const lanzar = await screen.findByRole('button', { name: 'Generar 37 casos' });
    expect(screen.getByLabelText(/concurrencia/)).toHaveValue(3);
    expect(screen.getByLabelText(/Tiempo máximo/)).toHaveValue(30);
    expect(screen.getByLabelText(/^Comprobar determinismo/)).toBeChecked();

    fireEvent.click(lanzar);
    await waitFor(() =>
      expect(mockedApiRequest).toHaveBeenCalledWith(
        '/v1/qa-lab/versions/4001/runs',
        expect.objectContaining({
          body: expect.objectContaining({
            seed: 'k3f2m1a',
            caseCount: 37,
            validPercent: 50,
            boundaryPercent: 30,
            invalidPercent: 20,
            concurrency: 3,
            timeoutMs: 30_000,
            checkDeterminism: true,
            coverOutcomes: false,
            distributions: [{ variableCode: 'edad', shape: 'LOW_TAIL' }],
          }),
        }),
      ),
    );
    const body = mockedApiRequest.mock.calls.find(([, o]) => o?.method === 'POST')?.[1]?.body;
    expect(body).not.toHaveProperty('environmentCode');
  });

  it('una corrida interrumpida dice por qué, en español', async () => {
    mockedApiRequest.mockImplementation(async (path) => {
      if (path.startsWith('/v1/qa-lab/runs?')) return HISTORIAL;
      if (path === '/v1/qa-lab/runs/900') {
        return {
          ...TERMINADA,
          id: '900',
          status: 'FAILED',
          summary: { failureCode: 'QA_RUN_UNEXPECTED_ERROR', failureMessage: 'sin conexión' },
        };
      }
      return {};
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Ver resultado/ }));
    expect(await screen.findByText(/error inesperado mientras ejecutaba el lote/)).toBeTruthy();
    expect(screen.getByText(/Detalle del motor: sin conexión/)).toBeTruthy();
  });

  it('una corrida cortada y sin fakers lo dice', async () => {
    mockedApiRequest.mockImplementation(async (path) => {
      if (path.startsWith('/v1/qa-lab/runs?')) return HISTORIAL;
      if (path === '/v1/qa-lab/runs/900') {
        return {
          ...TERMINADA,
          id: '900',
          stoppedReason: 'FIRST_FAILURE',
          executedCases: 3,
          plannedCases: 200,
          fakers: {
            source: 'local-fallback',
            reason: 'El servidor de fakers no respondió en 4000 ms.',
            mappedVariables: { ci: 'persona.documentNumber' },
          },
        };
      }
      return {};
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Ver resultado/ }));
    expect(await screen.findByText(/Se detuvo en el primer caso con fallo/)).toBeTruthy();
    expect(screen.getByText(/Ejecutó 3 de 200 casos/)).toBeTruthy();
    expect(screen.getByText(/no respondió en 4000 ms/)).toBeTruthy();
  });
});
