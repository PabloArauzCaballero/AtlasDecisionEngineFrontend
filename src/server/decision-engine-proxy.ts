import { NextRequest, NextResponse } from 'next/server';

const requestHeadersToRemove = [
  'connection',
  'content-length',
  'host',
  'transfer-encoding',
  /*
   * Cabeceras de procedencia: el navegador puede escribir cualquiera de estas y
   * el motor las cree. Si se reenvían tal cual, cualquiera puede declarar la IP
   * que quiera y contaminar el rastro de auditoría, las listas por IP y los
   * límites de frecuencia del backend. El proxy las descarta y vuelve a
   * declarar sólo las que él mismo puede acreditar.
   */
  'forwarded',
  'x-forwarded-for',
  'x-forwarded-host',
  'x-forwarded-port',
  'x-forwarded-proto',
  'x-real-ip',
  'true-client-ip',
  'cf-connecting-ip',
];
const responseHeadersToRemove = [
  'connection',
  'content-encoding',
  'content-length',
  'transfer-encoding',
];

/**
 * Techo de espera del salto portal→motor.
 *
 * El navegador ya se rinde a los 15 s (`NEXT_PUBLIC_API_TIMEOUT_MS`), pero este
 * salto no tenía ninguno: un motor que aceptaba la conexión y no respondía
 * dejaba la petición viva en el servidor de Next indefinidamente. Como el
 * operador ve el error del navegador y reintenta, cada intento sumaba otra
 * conexión colgada — y las que quedan detrás retienen su hueco del grupo. Se
 * corta un poco por encima del cliente para que, cuando los dos plazos apliquen,
 * el mensaje que llegue sea el del navegador, que es el más concreto.
 */
function upstreamTimeoutMs(): number {
  // Se lee por petición y no al cargar el módulo, igual que `DECISION_ENGINE_URL`:
  // un valor congelado en la importación no se puede ajustar sin reiniciar el
  // proceso, y deja la prueba obligada a esperar el plazo real.
  const declared = Number(process.env.DECISION_ENGINE_TIMEOUT_MS);
  return Number.isFinite(declared) && declared > 0 ? declared : 20_000;
}

/**
 * Plazo para las rutas que imprimen.
 *
 * Los 20 s de una consulta no valen aquí: imprimir arranca un navegador, compone
 * el documento y lo pagina, y el PRIMER render tras levantar el servicio es el
 * más lento de todos porque incluye el arranque de Chromium. Con el plazo corto,
 * el portal cortaba la conexión antes de que el worker terminara y el usuario
 * veía «la operación tardó demasiado» sobre un documento que se estaba generando
 * bien.
 *
 * Se deja por encima de `PDF_RENDER_TIMEOUT_MS` del worker (30 s de serie) para
 * que quien corte sea él —con su error explicado— y no este proxy.
 */
function printingTimeoutMs(): number {
  const declared = Number(process.env.PDF_PROXY_TIMEOUT_MS);
  return Number.isFinite(declared) && declared > 0 ? declared : 60_000;
}

/**
 * Rutas del generador documental que EXIGEN un navegador.
 *
 * La imagen de la API del motor no lleva Chromium —se separó a propósito para no
 * engordar todas las réplicas con 400 MiB que la mayoría nunca usa—, así que
 * imprimir contra ella falla con «no se pudo iniciar el navegador». Quien sí
 * puede es el servicio `pdf-worker`.
 *
 * El resto de `/pdf/*` sigue yendo al motor y NO es negociable: el catálogo, los
 * contratos y el casado con artefactos necesitan su base de datos, que el worker
 * suelto no tiene.
 */
const RUTAS_QUE_IMPRIMEN: readonly string[] = ['pdf/generate', 'pdf/preview'];

/**
 * Destino de las rutas que imprimen.
 *
 * Sin `PDF_WORKER_URL` se mantiene el motor: un despliegue que meta Chromium en
 * la imagen de la API sigue funcionando sin configurar nada, y uno que no lo
 * haga recibe el error explicado del generador en vez de un desvío silencioso a
 * un servicio que no existe.
 */
function pdfWorkerBaseUrl(): URL | undefined {
  const raw = process.env.PDF_WORKER_URL;
  if (!raw) return undefined;
  const url = new URL(raw);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('PDF_WORKER_URL debe usar HTTP o HTTPS.');
  }
  return url;
}

/**
 * Credencial del worker de PDF suelto.
 *
 * El worker exige clave de servicio desde que se descubrió que respondía sin ninguna: la misma
 * `GET /pdf/templates` daba 401 por el motor y 200 por el worker. Sólo viaja en el salto que va
 * al worker —nunca al motor, que autentica con la sesión de quien pide— y sólo desde el
 * servidor: esta función no se ejecuta en el navegador, así que la clave no llega al cliente.
 */
function pdfServiceKey(): string | undefined {
  const raw = process.env.PDF_WORKER_SERVICE_KEY?.trim();
  return raw ? raw : undefined;
}

function decisionEngineBaseUrl(): URL {
  const raw = process.env.DECISION_ENGINE_URL ?? 'http://localhost:3000';
  const url = new URL(raw);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('DECISION_ENGINE_URL debe usar HTTP o HTTPS.');
  }
  return url;
}

/**
 * Cadena de IPs del cliente, sólo cuando es creíble.
 *
 * Detrás de un ingress de confianza (`TRUSTED_PROXY=true`) el primer salto ya
 * escribió `x-forwarded-for` y merece llegar al motor. Expuesto directamente a
 * Internet, esa misma cabecera la elige quien llama, así que se descarta: es
 * preferible que el backend no sepa la IP a que registre una inventada.
 */
function trustedClientChain(request: NextRequest): string | null {
  if (process.env.TRUSTED_PROXY !== 'true') return null;
  const chain = request.headers.get('x-forwarded-for')?.trim();
  return chain ? chain : null;
}

/** Same-origin server proxy whose destination is resolved at request time. */
export async function proxyDecisionEngine(
  request: NextRequest,
  pathSegments: readonly string[],
): Promise<Response> {
  try {
    const encodedPath = pathSegments.map((segment) => encodeURIComponent(segment)).join('/');
    // La comparación es por prefijo de ruta COMPLETA, no por `includes`: un
    // template llamado «generate» no debe desviar su consulta de catálogo al
    // servicio de impresión.
    const imprime = RUTAS_QUE_IMPRIMEN.some(
      (ruta) => encodedPath === ruta || encodedPath.startsWith(`${ruta}/`),
    );
    const baseUrl = (imprime ? pdfWorkerBaseUrl() : undefined) ?? decisionEngineBaseUrl();
    const timeoutMs = imprime ? printingTimeoutMs() : upstreamTimeoutMs();
    const target = new URL(encodedPath, `${baseUrl.toString().replace(/\/+$/, '')}/`);
    target.search = request.nextUrl.search;

    // La procedencia del cliente sólo se conserva si el despliegue declara que
    // hay un proxy de confianza delante (`TRUSTED_PROXY=true`). Sin esa promesa
    // la cabecera la escribe el propio navegador y vale menos que nada.
    const clientChain = trustedClientChain(request);

    const headers = new Headers(request.headers);
    requestHeadersToRemove.forEach((header) => headers.delete(header));
    // Native fetch decodes compressed bodies. Asking the internal hop for identity
    // avoids forwarding a stale content-encoding header to the browser.
    headers.set('accept-encoding', 'identity');
    headers.set('x-forwarded-host', request.nextUrl.host);
    headers.set('x-forwarded-proto', request.nextUrl.protocol.replace(':', ''));
    if (clientChain) headers.set('x-forwarded-for', clientChain);

    /*
     * Al worker sólo se le presta la clave si QUIEN PIDE trae sesión.
     *
     * Sin esta guarda el portal es un «diputado confundido»: el resto de `/pdf/*` va al motor,
     * que exige credencial y roles, pero `generate` y `preview` se desvían al worker, y el
     * worker sólo comprueba la clave de SERVICIO — que la pone el portal. Medido:
     *
     *     GET  :5180/pdf/templates sin sesión → 401   (va al motor)
     *     POST :5180/pdf/generate  sin sesión → 422   (pasó de largo)
     *
     * O sea que cualquiera que alcanzara el portal podía fabricar documentos con la identidad
     * institucional. Ya pasaba antes de que el worker tuviera puerta —entonces no pedía nada—,
     * así que ponerle credencial de servicio no lo arregló: lo disfrazó.
     *
     * Se exige el mismo `Authorization` que el motor pediría. NO sustituye a validar el token:
     * eso lo hace el motor en el resto de rutas y el worker todavía no sabe hacerlo. Lo que
     * cierra es el acceso anónimo, que es el agujero real; queda anotado que un token caducado
     * o robado seguiría pasando hasta que el worker valide el JWT.
     */
    if (imprime) {
      const credencial = request.headers.get('authorization');
      if (!credencial) {
        return NextResponse.json(
          {
            code: 'UNAUTHORIZED',
            message: 'Generar un documento exige una sesión activa.',
          },
          { status: 401 },
        );
      }
      // La clave del worker SÓLO en el salto que va al worker. Mandarla también al motor
      // filtraría una credencial de servicio a un destino que no la necesita, y la primera
      // regla de una credencial es que no viaje a donde no hace falta.
      const serviceKey = pdfServiceKey();
      if (serviceKey) headers.set('x-pdf-service-key', serviceKey);
    }

    const canHaveBody = request.method !== 'GET' && request.method !== 'HEAD';
    const body = canHaveBody ? await request.arrayBuffer() : undefined;
    /*
     * El plazo cubre hasta la CABECERA de la respuesta, no el cuerpo entero: los
     * flujos de eventos (`text/event-stream`) mantienen el cuerpo abierto a
     * propósito mientras el motor ejecuta, y abortarlos a los 20 s cortaría una
     * ejecución en marcha. `AbortSignal.timeout` deja de aplicar en cuanto se
     * empieza a leer el cuerpo, que es justo el reparto que hace falta.
     */
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: body?.byteLength ? body : undefined,
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });
    /*
     * Un 401 del WORKER no es un 401 de quien mira la pantalla.
     *
     * Cuando el generador documental rechaza la clave de servicio —o el despliegue no la tiene
     * configurada— el fallo es del portal hablando con otro servicio, no de la sesión de nadie.
     * Reenviarlo tal cual tenía una consecuencia desproporcionada y medida: `authorizedFetch`
     * trata CUALQUIER 401 como «la sesión murió», así que renovaba el token, reintentaba,
     * recibía el mismo 401 y llamaba a `expireSession()`. Resultado: pulsar «generar» echaba a
     * la persona del portal con el mensaje «Tu sesión venció», que manda a mirar las
     * credenciales de acceso cuando lo que falta es una variable de entorno del servidor.
     *
     * Se traduce a 502: es exactamente lo que significa —la pasarela no pudo autenticarse
     * contra su servicio de aguas abajo— y no toca la sesión. El código propio dice dónde
     * mirar.
     */
    if (imprime && (upstream.status === 401 || upstream.status === 403)) {
      return NextResponse.json(
        {
          code: 'PDF_WORKER_UNAUTHORIZED',
          message:
            'El portal no pudo acreditarse ante el generador documental. Es un problema de ' +
            'configuración del servidor (PDF_WORKER_SERVICE_KEY), no de tu sesión.',
        },
        { status: 502 },
      );
    }

    const responseHeaders = new Headers(upstream.headers);
    responseHeadersToRemove.forEach((header) => responseHeaders.delete(header));

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    // «No contesta» y «no llegué» se arreglan en sitios distintos: un 504 apunta
    // al motor sobrecargado y un 502 a la red o a la configuración del destino.
    // Con un único 502 para las dos, el registro no distinguía cuál era.
    const timedOut = error instanceof Error && error.name === 'TimeoutError';
    return NextResponse.json(
      timedOut
        ? {
            code: 'DECISION_ENGINE_TIMEOUT',
            message: 'El Decision Engine no respondió dentro del tiempo máximo.',
          }
        : {
            code: 'DECISION_ENGINE_UNAVAILABLE',
            message: 'No fue posible conectar el portal con el Decision Engine.',
          },
      { status: timedOut ? 504 : 502 },
    );
  }
}
