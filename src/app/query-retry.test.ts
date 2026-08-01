import { ApiError } from '../api/ApiError';
import { shouldRetryQuery } from './QueryProvider';

describe('política de reintentos de las consultas', () => {
  it('reintenta lo que pudo fallar por el camino', () => {
    for (const status of [0, 500, 502, 503, 504]) {
      expect(shouldRetryQuery(0, new ApiError('caída', status))).toBe(true);
    }
    expect(shouldRetryQuery(0, new ApiError('tarde', 408))).toBe(true);
  });

  it('no reintenta lo que va a volver a fallar igual', () => {
    // Antes sólo se excluía el 403: un 404 o un 422 se pedían dos veces y el
    // operador esperaba el doble para ver el mismo error.
    for (const status of [400, 401, 403, 404, 409, 422, 429, 499]) {
      expect(shouldRetryQuery(0, new ApiError('no', status))).toBe(false);
    }
  });

  it('nunca va más allá de un reintento', () => {
    expect(shouldRetryQuery(1, new ApiError('caída', 500))).toBe(false);
  });

  it('reintenta una vez lo que ni siquiera es un ApiError', () => {
    expect(shouldRetryQuery(0, new Error('boom'))).toBe(true);
  });
});
