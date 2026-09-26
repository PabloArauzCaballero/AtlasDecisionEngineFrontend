import { NextRequest, NextResponse } from 'next/server';

/**
 * Autorización de las rutas que imprimen cuando van al worker suelto (ATL-01).
 *
 * El worker sólo comprueba la clave de SERVICIO, y esa la pone el portal. Antes bastaba con que
 * la petición trajera un `Authorization` cualquiera —«x» servía— para que el portal prestara la
 * clave e imprimiera con la identidad institucional. Ahora el portal no presta nada sin que el
 * MOTOR haya aceptado antes ese mismo `Authorization` con la misma política que protege la
 * impresión.
 *
 * La comprobación es `GET /pdf/templates` del motor con el bearer del usuario. No es un atajo:
 * en el motor, `PdfCatalogController` (`src/pdf-worker/presentation/http/pdf-catalog.controller.ts`,
 * `@Roles` en la línea 53 y `@Get('templates')` en la 63) y `PdfGenerationController`
 * (`pdf-generation.controller.ts:55`) declaran EXACTAMENTE los mismos roles, y los dos pasan por
 * los guardias globales de identidad y roles. Un 2xx ahí significa «esta sesión es válida y puede
 * imprimir»; un 401, sesión inválida; un 403, sesión válida sin rol. El motor no publica ningún
 * endpoint que devuelva la identidad y los roles del llamante (`v1/session` sólo tiene login,
 * refresh, logout y cambio de contraseña), así que se pregunta por la autorización, que es lo
 * que hace falta, y no por la identidad.
 */

const VERIFICATION_PATH = 'pdf/templates';

function verificationTimeoutMs(): number {
  const declared = Number(process.env.PDF_AUTHORIZATION_TIMEOUT_MS);
  return Number.isFinite(declared) && declared > 0 ? declared : 10_000;
}

function unavailable(): Response {
  return NextResponse.json(
    {
      code: 'PDF_AUTHORIZATION_UNAVAILABLE',
      message:
        'No se pudo comprobar tu sesión con el Decision Engine; no se generó ningún documento.',
    },
    { status: 503 },
  );
}

/**
 * Pregunta al motor si `authorization` puede imprimir.
 *
 * Devuelve `null` si puede; si no, la respuesta que hay que dar al navegador SIN tocar el worker:
 * 401 (sesión inválida), 403 (sin rol) o 503 (el motor no respondió o respondió otra cosa).
 * Nunca se «deja pasar» por duda: cualquier resultado que no sea un 2xx del motor cierra.
 */
export async function verifyPrintingAuthorization(
  engineBaseUrl: URL,
  request: NextRequest,
  authorization: string,
  forwarded: Headers,
): Promise<Response | null> {
  const target = new URL(VERIFICATION_PATH, `${engineBaseUrl.toString().replace(/\/+$/, '')}/`);
  const headers = new Headers({ accept: 'application/json', authorization });
  for (const name of ['x-forwarded-host', 'x-forwarded-proto', 'x-forwarded-for']) {
    const value = forwarded.get(name);
    if (value) headers.set(name, value);
  }

  const controller = new AbortController();
  const onClientAbort = () => controller.abort(request.signal?.reason);
  request.signal?.addEventListener('abort', onClientAbort, { once: true });
  const timer = setTimeout(() => controller.abort(), verificationTimeoutMs());
  try {
    const verdict = await fetch(target, {
      method: 'GET',
      headers,
      redirect: 'manual',
      cache: 'no-store',
      signal: controller.signal,
    });
    // El cuerpo (el catálogo) no interesa: se descarta para liberar la conexión.
    await verdict.body?.cancel().catch(() => undefined);
    if (verdict.ok) return null;
    if (verdict.status === 401) {
      return NextResponse.json(
        { code: 'UNAUTHORIZED', message: 'Tu sesión no es válida para generar documentos.' },
        { status: 401 },
      );
    }
    if (verdict.status === 403) {
      return NextResponse.json(
        { code: 'FORBIDDEN', message: 'Tu perfil no tiene permiso para generar documentos.' },
        { status: 403 },
      );
    }
    return unavailable();
  } catch {
    return unavailable();
  } finally {
    clearTimeout(timer);
    request.signal?.removeEventListener('abort', onClientAbort);
  }
}
