import type { NextRequest } from 'next/server';
import { proxyDecisionEngine } from '../../server/decision-engine-proxy';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  return proxyDecisionEngine(request, ['metrics']);
}
