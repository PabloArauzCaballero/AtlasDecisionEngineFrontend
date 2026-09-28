import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ApiError } from '../../api/ApiError';
import { askAssist, fetchAssistConversation } from './assist.api';
import { AssistLauncher } from './AssistLauncher';

vi.mock('next/navigation', () => ({ usePathname: () => '/deployments' }));
vi.mock('./assist.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./assist.api')>()),
  askAssist: vi.fn(),
  fetchAssistConversation: vi.fn(),
}));

const ask = vi.mocked(askAssist);
const history = vi.mocked(fetchAssistConversation);

const EMPTY = { conversationId: null, turns: [] };

function openPanel() {
  fireEvent.click(screen.getByRole('button', { name: 'Asistente de Atlas' }));
  return screen.getByRole('dialog', { name: 'Asistente de Atlas' });
}

describe('AssistLauncher', () => {
  afterEach(() => vi.clearAllMocks());

  it('el botón está siempre a la vista y el panel abre con el hilo y el aviso fijo', async () => {
    history.mockResolvedValue({
      conversationId: 'c-1',
      turns: [
        {
          turnId: 't-1',
          prompt: '¿Qué es un ambiente?',
          reply: 'Es donde corre una versión.',
          suggestHandoff: false,
          createdAt: null,
        },
      ],
    });
    render(<AssistLauncher />);

    const dialog = openPanel();
    expect(dialog).toHaveAccessibleDescription(
      'No escribas contraseñas, códigos ni datos personales.',
    );
    expect(await screen.findByText('Es donde corre una versión.')).toBeInTheDocument();
    expect(screen.getByText('Motor de decisión · Gobierno › Despliegues')).toBeInTheDocument();
  });

  it('apagado en el ambiente: lo dice, apaga el campo y NO esconde el botón', async () => {
    history.mockRejectedValue(new ApiError('Apagado', 404, 'ASSIST_DISABLED'));
    render(<AssistLauncher />);
    openPanel();

    expect(
      await screen.findByText('El asistente todavía no está encendido en este ambiente.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Tu pregunta para el asistente' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Asistente de Atlas' })).toBeInTheDocument();
  });

  it('Enter envía con la pantalla actual, muestra «Pensando…» y luego la respuesta', async () => {
    history.mockResolvedValue(EMPTY);
    let resolve: (value: Awaited<ReturnType<typeof askAssist>>) => void = () => undefined;
    ask.mockReturnValue(new Promise((r) => (resolve = r)));
    render(<AssistLauncher />);
    openPanel();
    await screen.findByText(/Pregúntame cómo hacer algo/);

    const field = screen.getByRole('textbox', { name: 'Tu pregunta para el asistente' });
    fireEvent.change(field, { target: { value: '¿Cómo despliego?' } });
    fireEvent.keyDown(field, { key: 'Enter' });

    expect(await screen.findByText('Pensando…')).toBeInTheDocument();
    expect(ask).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: '¿Cómo despliego?', screen: 'Gobierno › Despliegues' }),
    );
    const clientMessageId = ask.mock.calls[0]![0].clientMessageId;
    expect(clientMessageId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-/);

    await act(async () =>
      resolve({
        reply: 'Abre «Despliegues».',
        suggestHandoff: false,
        conversationId: 'c-2',
        turnId: 't-9',
        mode: 'sin-ia',
      }),
    );
    expect(screen.getByText('Abre «Despliegues».')).toBeInTheDocument();
    expect(screen.getByText('Respuesta sin IA: texto de la guía.')).toBeInTheDocument();
    expect(screen.queryByText('Pensando…')).not.toBeInTheDocument();
  });

  it('Shift+Enter no envía', async () => {
    history.mockResolvedValue(EMPTY);
    render(<AssistLauncher />);
    openPanel();
    await screen.findByText(/Pregúntame cómo hacer algo/);
    const field = screen.getByRole('textbox', { name: 'Tu pregunta para el asistente' });
    fireEvent.change(field, { target: { value: 'línea uno' } });
    fireEvent.keyDown(field, { key: 'Enter', shiftKey: true });
    expect(ask).not.toHaveBeenCalled();
  });

  it('un fallo se explica y «Reintentar» repite con la misma clave', async () => {
    history.mockResolvedValue(EMPTY);
    ask.mockRejectedValueOnce(new ApiError('x', 503, 'ASSIST_UNAVAILABLE')).mockResolvedValueOnce({
      reply: 'Ahora sí.',
      suggestHandoff: false,
      conversationId: 'c-1',
      turnId: 't-1',
      mode: null,
    });
    render(<AssistLauncher />);
    openPanel();
    await screen.findByText(/Pregúntame cómo hacer algo/);
    const field = screen.getByRole('textbox', { name: 'Tu pregunta para el asistente' });
    fireEvent.change(field, { target: { value: 'Hola' } });
    fireEvent.submit(field.closest('form')!);

    expect(await screen.findByRole('alert')).toHaveTextContent(/no está disponible/);
    fireEvent.click(screen.getByRole('button', { name: /Reintentar/ }));

    expect(await screen.findByText('Ahora sí.')).toBeInTheDocument();
    expect(ask.mock.calls[1]![0].clientMessageId).toBe(ask.mock.calls[0]![0].clientMessageId);
    expect(screen.getAllByText('Hola')).toHaveLength(1);
  });

  it('Escape cierra y devuelve el foco al botón', async () => {
    history.mockResolvedValue(EMPTY);
    render(<AssistLauncher />);
    const launcher = screen.getByRole('button', { name: 'Asistente de Atlas' });
    launcher.focus();
    openPanel();
    await screen.findByText(/Pregúntame cómo hacer algo/);
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Tu pregunta para el asistente' })).toHaveFocus(),
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(launcher).toHaveFocus();
  });
});
