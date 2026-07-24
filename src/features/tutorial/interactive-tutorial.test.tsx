import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const apiRequest = vi.hoisted(() => vi.fn().mockResolvedValue([]));
vi.mock('../../api/http-client', () => ({ apiRequest }));

const { InteractiveTutorialProvider } = await import('./InteractiveTutorialProvider');
const { useInteractiveTutorial } = await import('./useInteractiveTutorial');
const { notifyErrorWithTutorial, notifyApiError } = await import('./error-tutorial');
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
  return render(
    <InteractiveTutorialProvider>
      <Harness />
    </InteractiveTutorialProvider>,
  );
}

describe('tutorial interactivo', () => {
  it('inicia en el primer paso y navega con Siguiente', async () => {
    renderApp();
    fireEvent.click(screen.getByText('go'));

    expect(await screen.findByText('Qué es esta pantalla')).toBeInTheDocument();
    expect(screen.getByText('Paso 1 de 4')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Siguiente/ }));
    expect(screen.getByText('Pestaña Resumen')).toBeInTheDocument();
  });

  it('un paso con acción requerida NO avanza con Siguiente: espera el clic real', async () => {
    renderApp();
    fireEvent.click(screen.getByText('go'));
    fireEvent.click(await screen.findByRole('button', { name: /Siguiente/ })); // -> Resumen
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/ })); // -> Abrí las versiones

    // Paso con requiredAction: no hay botón Siguiente, hay aviso de acción.
    expect(screen.getByText('Abrí las versiones')).toBeInTheDocument();
    expect(screen.getByText(/Hacé la acción resaltada/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Siguiente/ })).toBeNull();

    // Al hacer el clic REAL sobre el elemento resaltado, avanza (y como el paso
    // opcional del grafo no tiene target, se salta y el tutorial se completa).
    fireEvent.click(screen.getByRole('button', { name: 'Versiones' }));

    await waitFor(() => expect(screen.queryByText('Abrí las versiones')).toBeNull());
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

  it('notifyErrorWithTutorial agrega la acción "Ver tutorial guiado"', () => {
    const notify = vi.fn();
    const startForError = vi.fn();
    notifyErrorWithTutorial({
      code: 'VALIDATION_ERROR',
      message: 'campo inválido',
      notify,
      startForError,
    });

    const input = notify.mock.calls[0][0];
    expect(input.tone).toBe('error');
    expect(input.action?.label).toBe('Ver tutorial guiado');
    input.action.onSelect();
    expect(startForError).toHaveBeenCalledWith('VALIDATION_ERROR');
  });

  it('un error sin tutorial asociado no ofrece acción', () => {
    const notify = vi.fn();
    notifyErrorWithTutorial({
      code: 'UNKNOWN_CODE',
      message: 'boom',
      notify,
      startForError: vi.fn(),
    });
    expect(notify.mock.calls[0][0].action).toBeUndefined();
  });

  it('notifyApiError cae al kind cuando el código no tiene tutorial', () => {
    const notify = vi.fn();
    const startForError = vi.fn();
    // kind "validation" está mapeado; el código puntual no.
    const error = new ApiError('faltan campos', 422, 'SIN_TUTORIAL', 'req-1', 'validation');
    notifyApiError(error, notify, startForError);

    const input = notify.mock.calls[0][0];
    expect(input.action?.label).toBe('Ver tutorial guiado');
    input.action.onSelect();
    expect(startForError).toHaveBeenCalledWith('validation');
  });

  it('notifyApiError prioriza el código específico sobre el kind', () => {
    const notify = vi.fn();
    const startForError = vi.fn();
    const error = new ApiError('inválido', 400, 'VALIDATION_ERROR', 'req-2', 'validation');
    notifyApiError(error, notify, startForError);

    notify.mock.calls[0][0].action.onSelect();
    expect(startForError).toHaveBeenCalledWith('VALIDATION_ERROR');
  });

  it('cada error mapeado apunta a un tutorial existente (cadena error→tutorial íntegra)', () => {
    for (const link of Object.values(ERROR_TUTORIALS)) {
      expect(TUTORIALS[link.tutorialId], `falta el tutorial ${link.tutorialId}`).toBeDefined();
    }
  });
});
