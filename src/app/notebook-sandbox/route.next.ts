import {
  documentoDelSandbox,
  politicaDelSandbox,
} from '@/features/data-notebook/sandbox/documento';

export const dynamic = 'force-dynamic';

/**
 * El documento del marco aislado donde corren las celdas del cuaderno (MOT-03).
 *
 * Lleva su PROPIA CSP —con `sandbox allow-scripts`, sin red salvo `/pyodide/`— y el middleware no
 * le pone la del portal: dos políticas en la misma respuesta se aplican a la vez, y la del portal
 * (`frame-ancestors 'none'`) impediría montarlo. Tampoco lleva `X-Frame-Options: DENY`
 * (`next.config.ts`); lo sustituye `frame-ancestors 'self'`.
 */
export function GET(request: Request) {
  const nonce = crypto.randomUUID().replaceAll('-', '');
  return new Response(documentoDelSandbox(nonce), {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'content-security-policy': politicaDelSandbox(nonce, request.headers.get('host')),
      'cache-control': 'no-store',
    },
  });
}
