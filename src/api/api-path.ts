import { isInternalPath } from '../utils/internal-path';
import { ApiError } from './ApiError';

/**
 * Toda ruta de API es relativa al propio origen y de UN solo segmento inicial.
 *
 * `//otro-host/x` es una URL absoluta disfrazada de ruta: `fetch` la resolvería contra ese host y se
 * llevaría la cabecera `authorization` con el token de la sesión. Se rechaza antes de salir.
 *
 * «Empieza por `/` y no por `//`» no basta: `/\otro-host/x` y `/<tab>/otro-host/x` también se
 * resuelven a `//otro-host/x` en el analizador de URL del navegador (trata `\` como `/` y borra
 * tabuladores y saltos de línea). La decisión es la misma que la del `?from=` del login y la de los
 * enlaces del cuaderno: `isInternalPath`, que resuelve la ruta como lo hará el navegador.
 */
export function assertSafeApiPath(path: string): void {
  if (!isInternalPath(path)) {
    throw new ApiError(
      'La ruta de API no es válida.',
      400,
      'INVALID_API_PATH',
      undefined,
      'validation',
    );
  }
}
