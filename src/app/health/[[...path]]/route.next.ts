import { NextResponse, type NextRequest } from 'next/server';
import { proxyDecisionEngine } from '../../../server/decision-engine-proxy';
import { isPublicHealthPath } from '../../../server/health-paths';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ path?: string[] }>;
}

async function forward(request: NextRequest, context: RouteContext) {
  const { path = [] } = await context.params;
  // Sólo las sondas que se usan; `health/data-sources` y el resto se quedan en la red interna.
  if (!isPublicHealthPath(path)) {
    return NextResponse.json(
      { code: 'NOT_FOUND', message: 'Ruta no disponible desde el portal.' },
      { status: 404 },
    );
  }
  return proxyDecisionEngine(request, ['health', ...path]);
}

export const GET = forward;
