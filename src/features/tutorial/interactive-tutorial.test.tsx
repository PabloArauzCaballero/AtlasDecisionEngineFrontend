import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const apiRequest = vi.hoisted(() => vi.fn().mockResolvedValue([]));
vi.mock('../../api/http-client', () => ({ apiRequest }));

const { InteractiveTutorialProvider } = await import('./InteractiveTutorialProvider');
const { useInteractiveTutorial } = await import('./useInteractiveTutorial');
const { tutorialCodeFor, notifyApiError } = await import('./error-tutorial');
const { ERROR_TUTORIALS, TUTORIALS } = await import('./interactive-catalog');
const { ApiError } = await import('../../api/ApiError');

function Harness() {
  const { start, startForError } = useInteractiveTutorial();
  return (
    <div>
      <button type="button" onClick={() => start('artifact-detail')}>
        go
      </button>
      <button type="button" onClick={() => startForError('VALIDATION_ERROR')}>
        goErr
      </button>
      {/* Targets que el tutorial resalta (sin `.version-graph`, para probar el salto). */}
      <button type="button" id="artifact-tab-summary">
        Resumen
      </button>
      <button type="button" id="artifact-tab-versions">
        Versiones
      </button>
    </div>
  );
}

function renderApp() {
  // Ya en `/artifacts` y sin tabla en el DOM: el paso que pide abrir una ficha
  // es opcional, así que el recorrido lo salta solo y arranca en la ficha, que
  // es lo que estas pruebas cubren.
  return render(
    <InteractiveTutorialProvider router={{ pathname: '/artifacts', push: vi.fn() }}>
      <Harness />
    </InteractiveTutorialProvider>,
  );
}

describe('tutorial interactivo', () => {
  it('inicia en el primer paso y navega con Siguiente', async () => {
    renderApp();
    fireEvent.click(screen.getByText('go'));

    expect(await screen.findByText('Qué es esta pantalla')).toBeInTheDocument();
    // Paso 2: el primero pide abrir una ficha y aquí ya se dio por abierta.
    expect(screen.getByText(/paso 2 de 5/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Siguiente/ }));
    expect(screen.getByText('Pestaña Resumen')).toBeInTheDocument();
  });

  it('un paso con acción requerida NO avanza con Siguiente: espera el clic real', async () => {
    renderApp();
    fireEvent.click(screen.getByText('go'));
    fireEvent.click(await screen.findByRole('button', { name: /Siguiente/ })); // -> Resumen
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/ })); // -> Abre las versiones

    // Paso con requiredAction: no hay botón Siguiente, hay aviso de acción.
    expect(screen.getByText('Abre las versiones')).toBeInTheDocument();
    expect(screen.getByText(/Haz clic en lo resaltado/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Siguiente/ })).toBeNull();

    // Al hacer el clic REAL sobre el elemento resaltado, avanza (y como el paso
    // opcional del grafo no tiene target, se salta y el tutorial se completa).
    fireEvent.click(screen.getByRole('button', { name: 'Versiones' }));

    await waitFor(() => expect(screen.queryByText('Abre las versiones')).toBeNull());
    // Al completar (el paso opcional del grafo se saltó), se persiste COMPLETED.
    const completed = apiRequest.mock.calls.some(
      (call) =>
        String(call[0]).includes('artifact-detail') &&
        call[1]?.method === 'PUT' &&
        call[1]?.body?.status === 'COMPLETED',
    );
    expect(completed).toBe(true);
  });

  it('startForError inicia el tutorial que explica ese error', async () => {
    renderApp();
    fireEvent.click(screen.getByText('goErr'));
    expect(await screen.findByText('Qué pasó')).toBeInTheDocument();
  });

  it('tutorialCodeFor cae al kind cuando el código puntual no tiene tutorial', () => {
    // kind "validation" está mapeado; el código puntual no.
    const error = new ApiError('faltan campos', 422, 'SIN_TUTORIAL', 'req-1', 'validation');
    expect(tutorialCodeFor(error)).toBe('validation');
  });

  it('tutorialCodeFor prioriza el código específico sobre el kind', () => {
    const error = new ApiError('inválido', 400, 'VALIDATION_ERROR', 'req-2', 'validation');
    expect(tutorialCodeFor(error)).toBe('VALIDATION_ERROR');
  });

  it('un error sin tutorial en ninguno de los dos niveles no ofrece recorrido', () => {
    const error = new ApiError('boom', 500, 'SIN_TUTORIAL', 'req-3', 'unexpected');
    expect(tutorialCodeFor(error)).toBeUndefined();
    expect(tutorialCodeFor(new Error('cualquier cosa'))).toBeUndefined();
  });

  it('notifyApiError ofrece la acción que abre el recorrido del error', () => {
    const notify = vi.fn();
    const startForError = vi.fn();
    notifyApiError(
      new ApiError('faltan campos', 422, 'SIN_TUTORIAL', 'req-1', 'validation'),
      notify,
      startForError,
    );

    const input = notify.mock.calls[0][0];
    expect(input.tone).toBe('error');
    // No repite el mensaje técnico: usa la explicación del catálogo.
    expect(input.description).not.toBe('faltan campos');
    input.action.onSelect();
    expect(startForError).toHaveBeenCalledWith('validation');
  });

  it('un error sin recorrido no ofrece acción', () => {
    const notify = vi.fn();
    notifyApiError(new ApiError('boom', 500, 'X', 'req-9', 'unexpected'), notify, vi.fn());
    expect(notify.mock.calls[0][0].action).toBeUndefined();
  });

  it('cada error mapeado apunta a un tutorial existente (cadena error→tutorial íntegra)', () => {
    for (const link of Object.values(ERROR_TUTORIALS)) {
      expect(TUTORIALS[link.tutorialId], `falta el tutorial ${link.tutorialId}`).toBeDefined();
    }
  });
});
