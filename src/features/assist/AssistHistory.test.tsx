import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ApiError } from '../../api/ApiError';
import { askAssist, fetchAssistConversation } from './assist.api';
import {
  deleteAssistConversation,
  getAssistConversationById,
  listAssistConversations,
} from './assist-history.api';
import { AssistLauncher } from './AssistLauncher';

vi.mock('next/navigation', () => ({ usePathname: () => '/deployments' }));
vi.mock('./assist.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./assist.api')>()),
  askAssist: vi.fn(),
  fetchAssistConversation: vi.fn(),
}));
vi.mock('./assist-history.api', () => ({
  listAssistConversations: vi.fn(),
  getAssistConversationById: vi.fn(),
  deleteAssistConversation: vi.fn(),
}));

const ask = vi.mocked(askAssist);
const current = vi.mocked(fetchAssistConversation);
const list = vi.mocked(listAssistConversations);
const byId = vi.mocked(getAssistConversationById);
const del = vi.mocked(deleteAssistConversation);

const turn = (id: string, prompt: string, reply: string) => ({
  turnId: id,
  prompt,
  reply,
  suggestHandoff: false,
  createdAt: null,
});
const ACTUAL = {
  conversationId: 'c-actual',
  turns: [turn('t1', '¿Qué es un ambiente?', 'Es donde corre una versión.')],
};
const OTRA = {
  conversationId: 'c-otra',
  turns: [turn('o1', '¿Cómo despliego?', 'Abre Despliegues.')],
};
const LISTA = [
  {
    conversationId: 'c-actual',
    title: 'Qué es un ambiente',
    updatedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    turnCount: 1,
  },
  {
    conversationId: 'c-otra',
    title: 'Cómo despliego',
    updatedAt: new Date(Date.now() - 26 * 3_600_000).toISOString(),
    turnCount: 3,
  },
];

async function open() {
  fireEvent.click(screen.getByRole('button', { name: 'Asistente de Atlas' }));
  await screen.findByText('Es donde corre una versión.');
}
const history = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Historial' }));
  await screen.findByRole('heading', { name: 'Historial de conversaciones' });
};
const deleteButton = (title: string) =>
  screen.getByRole('button', { name: `Borrar la conversación «${title}»` });

describe('Nueva conversación e Historial', () => {
  beforeEach(() => {
    current.mockResolvedValue(ACTUAL);
    list.mockResolvedValue(LISTA);
    byId.mockResolvedValue(OTRA);
    del.mockResolvedValue({ deleted: 1 });
  });
  afterEach(() => vi.resetAllMocks());

  it('«Nueva conversación» vacía el hilo sin llamar al servidor y la próxima pregunta va sin conversationId', async () => {
    render(<AssistLauncher />);
    await open();
    ask.mockResolvedValue({
      reply: 'Respuesta nueva',
      suggestHandoff: false,
      conversationId: 'c-nueva',
      turnId: 'n1',
      mode: null,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Nueva conversación' }));
    expect(screen.queryByText('Es donde corre una versión.')).not.toBeInTheDocument();
    expect(list).not.toHaveBeenCalled();
    expect(ask).not.toHaveBeenCalled();
    const box = screen.getByRole('textbox', { name: 'Tu pregunta para el asistente' });
    fireEvent.change(box, { target: { value: 'Hola' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar pregunta' }));
    await screen.findByText('Respuesta nueva');
    expect(ask.mock.calls[0]?.[0].conversationId).toBeNull();
  });

  it('está deshabilitada con el hilo vacío y lo explica', async () => {
    current.mockResolvedValue({ conversationId: null, turns: [] });
    render(<AssistLauncher />);
    fireEvent.click(screen.getByRole('button', { name: 'Asistente de Atlas' }));
    const button = await screen.findByRole('button', { name: 'Nueva conversación' });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription('Ya estás en una conversación nueva.');
  });

  it('está deshabilitada mientras hay un envío en curso', async () => {
    render(<AssistLauncher />);
    await open();
    ask.mockReturnValue(new Promise(() => {}));
    const box = screen.getByRole('textbox', { name: 'Tu pregunta para el asistente' });
    fireEvent.change(box, { target: { value: 'Hola' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar pregunta' }));
    const button = await screen.findByRole('button', { name: 'Nueva conversación' });
    await waitFor(() => expect(button).toBeDisabled());
    expect(button).toHaveAccessibleDescription(/Espera a que el asistente/);
  });

  it('el historial lista título, fecha relativa y mensajes, y marca la actual', async () => {
    render(<AssistLauncher />);
    await open();
    await history();
    const rows = await screen.findAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]!).getByText('hace 5 min · 2 mensajes')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('ayer · 6 mensajes')).toBeInTheDocument();
    expect(within(rows[0]!).getByRole('button', { name: /^Qué es un ambiente/ })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  it('abrir una conversación carga su hilo, vuelve al chat y sigue con su conversationId', async () => {
    render(<AssistLauncher />);
    await open();
    await history();
    fireEvent.click(await screen.findByRole('button', { name: /^Cómo despliego/ }));
    await screen.findByText('Abre Despliegues.');
    expect(byId).toHaveBeenCalledWith('c-otra');
    expect(
      screen.queryByRole('heading', { name: 'Historial de conversaciones' }),
    ).not.toBeInTheDocument();
    ask.mockResolvedValue({
      reply: 'Sigue',
      suggestHandoff: false,
      conversationId: 'c-otra',
      turnId: 'o2',
      mode: null,
    });
    const box = screen.getByRole('textbox', { name: 'Tu pregunta para el asistente' });
    fireEvent.change(box, { target: { value: 'Y luego' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar pregunta' }));
    await screen.findByText('Sigue');
    expect(ask.mock.calls[0]?.[0].conversationId).toBe('c-otra');
  });

  it('borrar pide confirmación en la fila, sin cuadros del navegador', async () => {
    const confirm = vi.spyOn(window, 'confirm');
    render(<AssistLauncher />);
    await open();
    await history();
    await screen.findAllByRole('listitem');
    fireEvent.click(deleteButton('Cómo despliego'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(del).not.toHaveBeenCalled();
    fireEvent.click(deleteButton('Cómo despliego'));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, borrar' }));
    await waitFor(() => expect(del).toHaveBeenCalledWith('c-otra'));
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(1));
    expect(confirm).not.toHaveBeenCalled();
  });

  it('borrar la conversación abierta reinicia el hilo', async () => {
    render(<AssistLauncher />);
    await open();
    await history();
    await screen.findAllByRole('listitem');
    fireEvent.click(deleteButton('Qué es un ambiente'));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, borrar' }));
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: /Volver al chat/ }));
    expect(screen.queryByText('Es donde corre una versión.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nueva conversación' })).toBeDisabled();
  });

  it('estado vacío', async () => {
    list.mockResolvedValue([]);
    render(<AssistLauncher />);
    await open();
    await history();
    await screen.findByText(/Todavía no tienes conversaciones guardadas/);
  });

  it('si la lista falla lo dice, deja reintentar y el chat sigue funcionando', async () => {
    list.mockRejectedValueOnce(new ApiError('boom', 500, 'X'));
    render(<AssistLauncher />);
    await open();
    await history();
    await screen.findByText(/No se pudo cargar el historial/);
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findAllByRole('listitem')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: /Volver al chat/ }));
    expect(screen.getByRole('textbox', { name: 'Tu pregunta para el asistente' })).toBeEnabled();
  });

  it('si la conversación ya no existe (404) avisa y la quita de la lista', async () => {
    byId.mockRejectedValue(new ApiError('no', 404, 'NOT_FOUND'));
    render(<AssistLauncher />);
    await open();
    await history();
    fireEvent.click(await screen.findByRole('button', { name: /^Cómo despliego/ }));
    await screen.findByText('Esa conversación ya no existe.');
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('si abrir o borrar falla por otra causa, avisa y conserva la fila', async () => {
    byId.mockRejectedValue(new Error('x'));
    del.mockRejectedValue(new Error('x'));
    render(<AssistLauncher />);
    await open();
    await history();
    fireEvent.click(await screen.findByRole('button', { name: /^Cómo despliego/ }));
    await screen.findByText(/No se pudo abrir esa conversación/);
    fireEvent.click(deleteButton('Cómo despliego'));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, borrar' }));
    await screen.findByText(/No se pudo borrar la conversación/);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });
});
