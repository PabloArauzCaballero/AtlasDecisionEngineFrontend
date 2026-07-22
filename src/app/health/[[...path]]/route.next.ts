import type { NextRequest } from 'next/server';
import { proxyDecisionEngine } from '../../../server/decision-engine-proxy';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ path?: string[] }>;
}

async function forward(request: NextRequest, context: RouteContext) {
  const { path = [] } = await context.params;
  return proxyDecisionEngine(request, ['health', ...path]);
}

export const GET = forward;
