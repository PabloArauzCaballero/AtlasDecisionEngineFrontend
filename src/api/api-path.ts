import { ApiError } from './ApiError';

/**
 * Toda ruta de API es relativa al propio origen y de UN solo segmento inicial.
 *
 * `//otro-host/x` es una URL absoluta disfrazada de ruta: `fetch` la resolvería contra ese host y se
 * llevaría la cabecera `authorization` con el token de la sesión. Se rechaza antes de salir.
 */
export function assertSafeApiPath(path: string): void {
  if (!path.startsWith('/') || path.startsWith('//')) {
    throw new ApiError(
      'La ruta de API no es válida.',
      400,
      'INVALID_API_PATH',
      undefined,
      'validation',
    );
  }
}
