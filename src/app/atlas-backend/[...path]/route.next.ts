import type { NextRequest } from 'next/server';
import { proxyAtlasBackend } from '../../../server/atlas-backend-proxy';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ path: string[] }>;
}

/**
 * Prefijo propio y no `/v1/*`.
 *
 * `/v1/*` está tomado por el motor, y el gate de superficie (`scripts/engine-surface.mjs`) lee los
 * literales `/v1/…` del código para decidir qué operaciones del motor están consumidas. Una ruta
 * de AtlasBackend escrita con ese mismo prefijo se contaría como consumo de una operación del
 * motor que nadie llama, y el gate diría que la superficie está cubierta cuando no lo está.
 */
async function forward(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyAtlasBackend(request, path);
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
export const OPTIONS = forward;
