'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, CircleAlert } from 'lucide-react';
import Link from 'next/link';
import { apiRequest } from '../../api/http-client';
import { asRecord, asRows, type UnknownRecord } from '../../utils/records';
import { reviewReadiness, type ReviewReadiness } from './review-readiness';

/**
 * Lee las suites de la versión y dice si puede enviarse a revisión.
 *
 * `known` es falso mientras se lee o si la lectura falla (p. ej. un rol que no ve las pruebas): entonces no se
 * afirma nada y se deja que el motor decida al pulsar, en vez de bloquear con un «le falta» que no se comprobó.
 */
export function useReviewReadiness(
  versionId: string,
  status: string | null,
): { known: boolean; readiness: ReviewReadiness | null } {
  const suites = useQuery({
    queryKey: ['review-readiness', versionId],
    queryFn: ({ signal }) =>
      apiRequest<unknown>(
        `/v1/artifact-versions/${encodeURIComponent(versionId)}/test-suites?page=1&pageSize=50`,
        {
          signal,
        },
      ),
    enabled: Boolean(versionId) && Boolean(status),
    retry: false,
  });
  if (!versionId || !status || !suites.isSuccess) return { known: false, readiness: null };
  const payload = suites.data;
  const rows: UnknownRecord[] = Array.isArray(payload)
    ? asRows(payload)
    : asRows(asRecord(payload).items);
  return { known: true, readiness: reviewReadiness(versionId, status, rows) };
}

/** «Qué le falta», punto por punto, con el enlace a donde se arregla cada uno. */
export function ReviewReadinessList({ readiness }: { readiness: ReviewReadiness }) {
  return (
    <ul
      className="gate-list"
      data-tutorial-id="review-readiness"
      aria-label="Requisitos para enviar a revisión"
    >
      {readiness.items.map((item) => (
        <li key={item.key} data-passing={item.ok ? 'yes' : 'no'}>
          <span>
            <strong>
              {item.ok ? <CheckCircle2 aria-hidden="true" /> : <CircleAlert aria-hidden="true" />}{' '}
              {item.title}
              <span className="sr-only">{item.ok ? ' — cumplido' : ' — pendiente'}</span>
            </strong>
            <small>{item.detail}</small>
          </span>
          {item.action ? (
            <Link className="button" href={item.action.href}>
              {item.action.label} <ArrowRight size={15} />
            </Link>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
