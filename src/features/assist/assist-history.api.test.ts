import { ApiError } from '../../api/ApiError';
import { configureHttpClient } from '../../api/http-client';
import {
  deleteAssistConversation,
  getAssistConversationById,
  listAssistConversations,
} from './assist-history.api';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
const envelope = (data: unknown) => ({ requestId: 'r-1', data, timestamp: '2026-09-29T10:00:00Z' });

describe('assist-history.api', () => {
  let cleanup: () => void;
  beforeEach(() => {
    cleanup = configureHttpClient({
      getAccessToken: () => 'token',
      refreshAccessToken: vi.fn().mockResolvedValue('otro'),
      expireSession: vi.fn(),
    });
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('lista con la superficie del Motor y tolera título nulo y conteo roto', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      json(
        envelope({
          conversations: [
            {
              conversationId: 'c-1',
              title: null,
              updatedAt: '2026-09-29T10:00:00Z',
              turnCount: 'x',
            },
          ],
        }),
      ),
    );
    const list = await listAssistConversations();
    expect(list).toEqual([
      { conversationId: 'c-1', title: null, updatedAt: '2026-09-29T10:00:00Z', turnCount: 0 },
    ]);
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain('/atlas-backend/internal/assist/conversations?surface=risk-portal');
  });

  it('abre una conversación por id (codificado) y devuelve sus turnos', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(json(envelope({ conversationId: 'c/1', title: 'T', turns: [] })));
    const thread = await getAssistConversationById('c/1');
    expect(thread.conversationId).toBe('c/1');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      '/conversations/c%2F1?surface=risk-portal',
    );
  });

  it('borra con DELETE y propaga el 404 como ApiError', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json(envelope({ deleted: 1 })))
      .mockResolvedValueOnce(json({ error: { code: 'NOT_FOUND', message: 'no' } }, 404));
    await expect(deleteAssistConversation('c-1')).resolves.toEqual({ deleted: 1 });
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('DELETE');
    await expect(getAssistConversationById('c-2')).rejects.toBeInstanceOf(ApiError);
  });
});
