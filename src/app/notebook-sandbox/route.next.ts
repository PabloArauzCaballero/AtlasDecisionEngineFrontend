import {
  documentoDelSandbox,
  politicaDelSandbox,
} from '@/features/data-notebook/sandbox/documento';

export const dynamic = 'force-dynamic';

/**
 * El documento de los marcos aislados donde corren las celdas del cuaderno (MOT-03): el general
 * (Python y JavaScript) y, con `?interprete=r`, el de R.
 *
 * Cada uno lleva su PROPIA CSP —con `sandbox allow-scripts`, sin red salvo los ficheros de su
 * intérprete— y el middleware no le pone la del portal: dos políticas en la misma respuesta se
 * aplican a la vez, y la del portal
 * (`frame-ancestors 'none'`) impediría montarlo. Tampoco lleva `X-Frame-Options: DENY`
 * (`next.config.ts`); lo sustituye `frame-ancestors 'self'`.
 */
export function GET(request: Request) {
  const nonce = crypto.randomUUID().replaceAll('-', '');
  // `?interprete=r` sirve el marco de R, con su propia CSP; cualquier otro valor, el general.
  const interprete = new URL(request.url).searchParams.get('interprete') === 'r' ? 'r' : 'general';
  return new Response(documentoDelSandbox(nonce, interprete), {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'content-security-policy': politicaDelSandbox(nonce, request.headers.get('host'), interprete),
      'cache-control': 'no-store',
    },
  });
}
