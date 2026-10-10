import { NextResponse, type NextRequest } from 'next/server';

/**
 * Política de seguridad de contenido (CSP) con nonce por petición.
 *
 * El portal gobierna decisiones de crédito y muestra datos que vienen del
 * motor: si alguna vista dejara escapar HTML ajeno, la CSP es la única capa que
 * impide que ese HTML ejecute algo. Se emite desde aquí y no desde
 * `next.config.ts` porque el nonce tiene que cambiar en cada respuesta, y
 * Next.js lo lee de esta cabecera para firmar también sus propios scripts.
 *
 * `'strict-dynamic'` deja que los scripts que ya llevan nonce (los de Next)
 * carguen sus propios fragmentos sin tener que enumerarlos. En desarrollo se
 * añade `'unsafe-eval'`, que el recargado en caliente necesita y producción no.
 */
function contentSecurityPolicy(nonce: string): string {
  const devOnly = process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : '';
  return [
    "default-src 'self'",
    /*
     * SIN `'wasm-unsafe-eval'` desde MOT-03.
     *
     * Lo pedía el Python del cuaderno (Pyodide, CPython compilado a WebAssembly) cuando corría en
     * esta pestaña. Ahora Python y R corren en el marco aislado `/notebook-sandbox`, que lleva su
     * propia CSP con ese token. La pestaña del portal ya no compila WebAssembly, así que no tiene
     * por qué poder hacerlo.
     */
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${devOnly}`,
    // Next.js inyecta estilos en línea al hidratar; no hay forma de firmarlos.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    /*
     * El audio del worker de locución llega como `blob:`, y sin esta línea NO
     * suena: `media-src` no estaba declarado, así que caía en `default-src
     * 'self'` y el navegador bloqueaba la reproducción. El fallo era silencioso
     * en la interfaz —el reproductor aparecía y no hacía nada—; sólo se veía en
     * la consola del navegador, que es donde nadie mira.
     *
     * `blob:` y no un origen: el portal no apunta el `<audio>` al motor, porque
     * cargar un medio es una navegación del navegador y ahí no viaja el
     * `Authorization`. Se pide con la credencial puesta y se reproduce local.
     */
    "media-src 'self' blob:",
    /*
     * Los PDF del expediente (matrícula, NIT, poder) se pintan en un `<iframe>` desde un `blob:`
     * local, igual que las imágenes: se piden con la credencial y nunca por una URL pública. Sin
     * `frame-src` el marco caía en `default-src 'self'` y quedaba en blanco, sin error en pantalla.
     *
     * `'self'` cubre también `/notebook-sandbox`, el marco aislado donde corren las celdas de
     * Python y JavaScript del cuaderno (MOT-03). No hace falta nada más: lo que lo aísla es el
     * atributo `sandbox` sin `allow-same-origin` y su propia CSP, no esta lista.
     */
    "frame-src 'self' blob:",
    "font-src 'self' data:",
    // Todo el tráfico de datos es del mismo origen: el proxy `/v1` lo reenvía.
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    // Los workers de las celdas ya no nacen aquí sino en el marco aislado; `blob:` sigue por los
    // del editor (Monaco), que no ejecutan código de nadie.
    "worker-src 'self' blob:",
    'upgrade-insecure-requests',
  ].join('; ');
}

export function middleware(request: NextRequest) {
  // El marco aislado del cuaderno trae su propia CSP (ver `src/app/notebook-sandbox`). Ponerle
  // además la del portal las sumaría, y su `frame-ancestors 'none'` impediría montarlo.
  if (request.nextUrl.pathname === '/notebook-sandbox') return NextResponse.next();
  /*
   * `/webr/` ya NO lleva una política propia de worker. WebR arranca dentro del marco aislado y su
   * worker nace allí de un `blob:`, con la CSP del marco (MOT-03). Antes `/webr/webr-worker.js` se
   * cargaba como worker del MISMO origen, con `connect-src 'self'` y la cookie de sesión. Si alguien
   * lo volviera a cargar así, recibiría la política del portal —con `'strict-dynamic'`, sin
   * `'unsafe-eval'` ni WebAssembly— y R no arrancaría: fallar cerrado es lo correcto.
   */

  const nonce = crypto.randomUUID().replaceAll('-', '');
  const policy = contentSecurityPolicy(nonce);

  // El nonce viaja en la petición para que el layout pueda firmar el script que
  // resuelve el tema antes del primer pintado.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('content-security-policy', policy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('content-security-policy', policy);
  return response;
}

export const config = {
  /**
   * Sólo documentos: los recursos estáticos y las imágenes optimizadas no
   * necesitan CSP y recalcular un nonce por cada uno sería puro coste.
   */
  matcher: [
    {
      source: '/((?!_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
