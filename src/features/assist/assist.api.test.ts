import { ApiError } from '../../api/ApiError';
import { configureHttpClient } from '../../api/http-client';
import {
  askAssist,
  assistErrorMessage,
  fetchAssistConversation,
  isAssistDisabled,
  retryAfterMs,
} from './assist.api';

const ID = '3f2b8c1e-8d4a-4c6b-9a1e-2f7d5b9c0a11';

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

/** El sobre con que AtlasBackend envuelve toda respuesta. */
const envelope = (data: unknown) => ({ requestId: 'r-1', data, timestamp: '2026-09-28T10:00:00Z' });

const inFlight = () =>
  json({ error: { code: 'ASSIST_IN_FLIGHT', message: 'Sigue en curso.' } }, 409, {
    'retry-after': '3',
  });

describe('assist.api', () => {
  let cleanup: () => void;

  beforeEach(() => {
    cleanup = configureHttpClient({
      getAccessToken: () => 'token-de-sesion',
      refreshAccessToken: vi.fn().mockResolvedValue('otro'),
      expireSession: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('pregunta a Core por el proxy del portal, con la sesión y la superficie del Motor', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      json(
        envelope({
          reply: 'Abre «Revisiones».',
          suggestHandoff: false,
          conversationId: 'c-1',
          turnId: 't-1',
          mode: 'sin-ia',
        }),
      ),
    );

    const answer = await askAssist({
      prompt: '¿Cómo apruebo?',
      clientMessageId: ID,
      conversationId: 'c-1',
      screen: 'Gobierno › Revisiones',
    });

    expect(answer).toEqual({
      reply: 'Abre «Revisiones».',
      suggestHandoff: false,
      conversationId: 'c-1',
      turnId: 't-1',
      mode: 'sin-ia',
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/atlas-backend/internal/assist/chat');
    expect(init?.method).toBe('POST');
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer token-de-sesion');
    expect(JSON.parse(String(init?.body))).toEqual({
      surface: 'risk-portal',
      prompt: '¿Cómo apruebo?',
      clientMessageId: ID,
      conversationId: 'c-1',
      screen: 'Gobierno › Revisiones',
    });
  });

  it('ante «sigue en curso» espera lo que pide Retry-After y repite con la MISMA clave', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(inFlight())
      .mockResolvedValueOnce(json({ reply: 'Listo.', suggestHandoff: true }));
    const wait = vi.fn().mockResolvedValue(undefined);

    const answer = await askAssist({ prompt: 'Hola', clientMessageId: ID }, { wait });

    expect(answer.reply).toBe('Listo.');
    expect(answer.suggestHandoff).toBe(true);
    expect(wait).toHaveBeenCalledWith(3_000);
    const keys = fetchMock.mock.calls.map(
      ([, init]) => JSON.parse(String(init?.body)).clientMessageId,
    );
    expect(keys).toEqual([ID, ID]);
  });

  it('se rinde tras tres reintentos silenciosos y deja el error para la pantalla', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => inFlight());
    const wait = vi.fn().mockResolvedValue(undefined);

    await expect(
      askAssist({ prompt: 'Hola', clientMessageId: ID }, { wait }),
    ).rejects.toMatchObject({
      code: 'ASSIST_IN_FLIGHT',
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(wait).toHaveBeenCalledTimes(3);
  });

  it('no repite un rechazo: el mensaje ya viene redactado para la persona', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        json({ code: 'ASSIST_REJECTED', message: 'Quita el número de documento.' }, 400),
      );

    const failure = await askAssist({ prompt: 'x', clientMessageId: ID }).catch((e) => e);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(assistErrorMessage(failure)).toBe('Quita el número de documento.');
  });

  it('lee el hilo de esta superficie y trata el 404 como «apagado»', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        json(
          envelope({
            conversationId: 'c-9',
            turns: [
              {
                turnId: 't-1',
                prompt: 'P',
                reply: 'R',
                suggestHandoff: false,
                createdAt: '2026-09-28T10:00:00Z',
              },
            ],
          }),
        ),
      )
      .mockResolvedValueOnce(json({ error: { code: 'ASSIST_DISABLED', message: 'Apagado' } }, 404));

    const conversation = await fetchAssistConversation();
    expect(conversation.conversationId).toBe('c-9');
    expect(conversation.turns).toHaveLength(1);
    expect(fetchMock.mock.calls[0]![0]).toBe(
      '/atlas-backend/internal/assist/conversation?surface=risk-portal',
    );

    const off = await fetchAssistConversation().catch((e) => e);
    expect(isAssistDisabled(off)).toBe(true);
  });

  it('acota Retry-After y da un valor por omisión si falta', () => {
    expect(retryAfterMs(new Response(null, { headers: { 'retry-after': '2' } }))).toBe(2_000);
    expect(retryAfterMs(new Response(null, { headers: { 'retry-after': '600' } }))).toBe(10_000);
    expect(retryAfterMs(new Response(null))).toBe(2_000);
  });

  it('traduce cada fallo a una frase sin jerga', () => {
    expect(assistErrorMessage(new ApiError('x', 429, 'ASSIST_BUSY'))).toMatch(/muchas consultas/);
    expect(assistErrorMessage(new ApiError('x', 503, 'ASSIST_UNAVAILABLE'))).toMatch(
      /no está disponible/,
    );
    expect(assistErrorMessage(new ApiError('x', 0, 'NETWORK_ERROR'))).toMatch(/conectar/);
    expect(assistErrorMessage(new Error('boom'))).toMatch(/no pudo responder/);
  });
});
