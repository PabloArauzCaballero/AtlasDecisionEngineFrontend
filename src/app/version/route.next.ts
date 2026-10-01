import { NextResponse } from 'next/server';
import { loadServedIdentity } from '@/lib/build-info';

export const dynamic = 'force-dynamic';

/**
 * Identidad del proceso que está sirviendo tráfico, no la punta actual de GitHub. El commit sale del
 * artefacto (`build-info.json`, escrito al construir la imagen); la variable de runtime sólo rellena si
 * el build no trae uno y nunca lo contradice (PLAT-03).
 */
export function GET() {
  const { commit, builtAt } = loadServedIdentity();
  return NextResponse.json(
    {
      service: 'atlas-decision-frontend',
      version: process.env.APP_VERSION ?? 'unknown',
      commit,
      builtAt,
      environment: process.env.NODE_ENV ?? 'unknown',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
