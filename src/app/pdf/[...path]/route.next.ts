import type { NextRequest } from 'next/server';
import { proxyDecisionEngine } from '../../../server/decision-engine-proxy';

/**
 * Paso al generador documental del motor.
 *
 * Existe por la misma razón que el de `/v1`: el navegador habla siempre con el
 * ORIGEN del portal y es el servidor quien reenvía al motor, que no está
 * publicado hacia fuera. Sin esta ruta, una llamada a `/pdf/health` la contesta
 * Next.js con un 404 y la pantalla lo lee como «el generador no respondió a la
 * sonda» — un fallo que parece del motor y en realidad es una ruta que falta.
 *
 * Es una ruta APARTE y no un comodín sobre `/:path*` a propósito: el proxy sólo
 * debe abrir los prefijos que alguien ha decidido abrir. Un comodín expondría
 * cualquier ruta que el motor publique en el futuro sin que nadie lo revise.
 */
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ path: string[] }>;
}

async function forward(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyDecisionEngine(request, ['pdf', ...path]);
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
export const OPTIONS = forward;
