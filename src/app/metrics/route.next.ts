import { NextResponse, type NextRequest } from 'next/server';
import { proxyDecisionEngine } from '../../server/decision-engine-proxy';

export const dynamic = 'force-dynamic';

/**
 * Las métricas del motor NO son públicas.
 *
 * Esta ruta reenviaba a `/metrics` del Decision Engine sin comprobar nada. Un
 * endpoint de Prometheus se suele publicar suponiendo que sólo lo alcanza el
 * raspador dentro de la red; ponerle delante un proxy accesible desde Internet
 * convierte esa suposición en falsa sin que nadie lo decida. Lo que sale por ahí
 * no es inocuo: nombres de todos los endpoints, latencias, tasas de error y
 * volúmenes por tenant — el mapa de la casa y cuándo está vacía.
 *
 * El portal no es el raspador. Quien vigila el motor lo hace contra el motor,
 * dentro de la red. Por eso aquí se exige un secreto compartido y, si el
 * despliegue no lo declara, la ruta simplemente NO existe: falla cerrado, que es
 * la única opción defendible cuando la alternativa es publicar de más.
 */
export function GET(request: NextRequest) {
  const expected = process.env.METRICS_SCRAPE_TOKEN;
  if (!expected) {
    return NextResponse.json(
      {
        code: 'METRICS_DISABLED',
        message:
          'Las métricas no se exponen a través del portal. Declara METRICS_SCRAPE_TOKEN para habilitarlas.',
      },
      { status: 404 },
    );
  }

  /*
   * Comparación de longitud constante. Un `===` sobre cadenas corta en el primer
   * byte distinto, y esa diferencia de tiempo es medible: deja adivinar el
   * secreto carácter a carácter con suficientes intentos.
   */
  const offered = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!safeEqual(offered, expected)) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'Credencial de raspado inválida.' },
      { status: 401 },
    );
  }

  return proxyDecisionEngine(request, ['metrics']);
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let differing = 0;
  for (let index = 0; index < a.length; index += 1) {
    differing |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return differing === 0;
}
