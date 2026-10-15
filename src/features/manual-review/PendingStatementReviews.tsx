'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Alert } from '../../components/Alert';
import { fetchStatementReviews } from '../workers/statement-review.api';

/** Más de esto esperando y el aviso sube a advertencia: es el plazo que Atlas le promete al cliente. */
const PLAZO_MS = 24 * 3_600_000;

function espera(ms: number): string {
  const horas = Math.floor(ms / 3_600_000);
  if (horas < 1) return 'menos de una hora';
  if (horas < 48) return `${horas} h`;
  return `${Math.floor(horas / 24)} días`;
}

/**
 * Los extractos bancarios que esperan a una persona, anunciados en «Revisión manual».
 *
 * El 2026-10-15 dos extractos llevaban ocho días en `PENDING_REVIEW` y nadie lo sabía: el Motor los guarda en la
 * bandeja del procesador de extractos (Procesadores automáticos → Extractos bancarios → Revisión), y «Revisión
 * manual» —donde se revisa todo lo demás— sólo listaba identidad y KYB. El cliente veía «en revisión» y aquí no
 * había nada. Las dos bandejas siguen separadas a propósito (los casos y sus acciones no se parecen), pero la que
 * se mira tiene que decir que existe la otra, con cuántos casos y desde cuándo.
 *
 * Sin permiso para la bandeja de extractos, o sin casos, no pinta nada.
 */
export function PendingStatementReviews() {
  const query = useQuery({
    queryKey: ['statement-reviews-pending-notice'],
    queryFn: ({ signal }) => fetchStatementReviews({ page: 1, pageSize: 50 }, signal),
    refetchInterval: 60_000,
    retry: false,
  });
  const page = query.data;
  if (!page || page.total === 0) return null;

  const masAntiguo = page.items.reduce((max, item) => Math.max(max, item.pendingMs ?? 0), 0);
  const vencido = masAntiguo > PLAZO_MS;
  return (
    <div className="pending-statement-reviews" data-testid="pending-statement-reviews">
      <Alert tone={vencido ? 'warning' : 'info'}>
        <strong>
          {page.total === 1 ? '1 extracto bancario espera revisión' : `${page.total} extractos bancarios esperan revisión`}
        </strong>
        {masAntiguo > 0 ? ` · el más antiguo, hace ${espera(masAntiguo)}` : ''}
        {vencido ? ' (pasó el plazo de 24 h que se le promete al cliente)' : ''}
        . No aparecen en esta lista: tienen su propia bandeja.{' '}
        <Link href="/workers/bank-statement?vista=revision">Revisar extractos</Link>
      </Alert>
    </div>
  );
}
