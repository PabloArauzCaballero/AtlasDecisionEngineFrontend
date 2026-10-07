'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  CircleSlash,
  FlaskConical,
  Loader,
  Wand2,
} from 'lucide-react';
import Link from 'next/link';
import { errorMessage } from '../../api/ApiError';
import { apiRequest } from '../../api/http-client';
import { canProposeArtifactChange } from '../../auth/business-rules';
import { useEffectiveRoles } from '../../auth/useAuth';
import { Alert } from '../../components/Alert';
import { asRecord, asRows, type UnknownRecord } from '../../utils/records';
import { reviewReadiness, type ReviewReadiness } from './review-readiness';
import { useGenerateCoverageSuite } from './useGenerateCoverageSuite';

/** Cada cuánto se vuelve a preguntar mientras una suite se está ejecutando. */
const RUNNING_REFRESH_MS = 2_000;

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
        { signal },
      ),
    enabled: Boolean(versionId) && Boolean(status),
    retry: false,
    // Con una corrida en marcha se vuelve a preguntar solo: la lista pasa a verde sin recargar.
    refetchInterval: (query) =>
      readinessOf(versionId, status, query.state.data)?.running ? RUNNING_REFRESH_MS : false,
  });
  if (!versionId || !status || !suites.isSuccess) return { known: false, readiness: null };
  return { known: true, readiness: readinessOf(versionId, status, suites.data) };
}

function readinessOf(
  versionId: string,
  status: string | null,
  payload: unknown,
): ReviewReadiness | null {
  if (payload === undefined || !status) return null;
  const rows: UnknownRecord[] = Array.isArray(payload)
    ? asRows(payload)
    : asRows(asRecord(payload).items);
  return reviewReadiness(versionId, status, rows);
}

/**
 * «Qué le falta», punto por punto, con el enlace a donde se arregla cada uno y, cuando lo que falta son pruebas
 * o cobertura, el botón para generarlas. Abajo, siempre, el acceso a las suites de la versión.
 */
export function ReviewReadinessList({
  versionId,
  readiness,
}: {
  versionId: string;
  readiness: ReviewReadiness;
}) {
  const canAuthor = canProposeArtifactChange(useEffectiveRoles());
  const generate = useGenerateCoverageSuite(versionId);
  const missing = generate.data?.complete === false ? (generate.data.nodes?.missing ?? []) : [];

  return (
    <>
      <ul
        className="gate-list"
        data-tutorial-id="review-readiness"
        aria-label="Requisitos para enviar a revisión"
      >
        {readiness.items.map((item) => (
          <li key={item.key} data-passing={item.ignored ? 'ignored' : item.ok ? 'yes' : 'no'}>
            <span>
              <strong>
                {item.ignored ? (
                  <CircleSlash aria-hidden="true" />
                ) : item.ok ? (
                  <CheckCircle2 aria-hidden="true" />
                ) : item.running ? (
                  <Loader aria-hidden="true" />
                ) : (
                  <CircleAlert aria-hidden="true" />
                )}{' '}
                {item.title}
                <span className="sr-only">
                  {item.ignored
                    ? ' — no cuenta'
                    : item.ok
                      ? ' — cumplido'
                      : item.running
                        ? ' — en curso'
                        : ' — pendiente'}
                </span>
              </strong>
              <small>{item.detail}</small>
            </span>
            <span className="stack-actions">
              {item.canGenerate ? (
                <button
                  type="button"
                  className="button button-primary"
                  data-tutorial-id="review-generate-suite"
                  disabled={!canAuthor || generate.isPending}
                  title={
                    canAuthor
                      ? 'El motor busca los casos que recorren todo el diagrama, los guarda como suite bloqueante y la ejecuta'
                      : 'Generar pruebas es de quien propone el cambio: analista de calidad o de fraude.'
                  }
                  onClick={() => generate.mutate()}
                >
                  <Wand2 size={15} />{' '}
                  {generate.isPending ? 'Generando…' : 'Generar pruebas automáticas'}
                </button>
              ) : null}
              {item.action ? (
                <Link className="button" href={item.action.href}>
                  {item.action.label} <ArrowRight size={15} />
                </Link>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      {generate.isError ? <Alert tone="error">{errorMessage(generate.error)}</Alert> : null}
      {missing.length ? (
        <Alert tone="warning">
          Ningún caso alcanza: {missing.map((node) => node.label ?? node.key).join(', ')}. Suele ser
          una rama que ninguna entrada válida puede tomar.
        </Alert>
      ) : null}
      <p className="muted-text readiness-footnote">
        <Link href={`/artifact-versions/${encodeURIComponent(versionId)}/test-suites`}>
          <FlaskConical size={14} aria-hidden="true" /> Ir a las suites de prueba de esta versión
        </Link>{' '}
        — las pruebas generadas fijan lo que el diagrama hace hoy; los casos de negocio se siguen
        escribiendo ahí.
      </p>
    </>
  );
}
