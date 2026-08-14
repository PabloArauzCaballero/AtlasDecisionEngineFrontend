'use client';

import { useQuery } from '@tanstack/react-query';
import { FileJson } from 'lucide-react';
import { Panel } from '../../components/Panel';
import { StatusBadge } from '../../components/StatusBadge';
import { formatDateTime } from '../../config/locale';
import { asRecord, asStrings } from '../../utils/records';
import { IdentityResultView } from './IdentityResultView';
import { downloadRunTrace } from './run-trace';
import { REASON_LABEL, type IdentityOutcome } from './identity-types';
import type { WorkerRun } from './worker-types';
import { fetchRuns } from './workers.api';

const WORKER = 'identity-verification' as const;

/**
 * Bandeja de verificaciones pendientes de revisión humana.
 *
 * Un `REVIEW_REQUIRED` no es un rechazo suave: es el contrato del worker
 * diciendo «el parecido cayó entre los dos umbrales calibrados y esto lo decide
 * una persona». Sin esta bandeja, ese veredicto sólo lo veía quien lanzó la
 * verificación, en el momento de lanzarla: el caso quedaba decidido por nadie,
 * que es el peor desenlace posible para el único estado que PIDE a alguien.
 *
 * La lista es la página más reciente de ejecuciones, filtrada aquí: el motor no
 * publica un filtro por veredicto —el `status` de la ejecución es del ciclo de
 * vida (`SUCCEEDED`…), no de la decisión—. Cuando hay más ejecuciones que
 * página, se dice cuántas se miraron: un tope silencioso se leería como «no hay
 * nada pendiente» cuando lo único cierto es «no hay nada en lo revisado».
 */
export function IdentityReviewQueue({ active }: { active: boolean }) {
  const runs = useQuery({
    queryKey: ['worker-runs', WORKER, 'revision'],
    queryFn: ({ signal }) => fetchRuns(WORKER, { pageSize: 50, signal }),
    // La pestaña que no se ve sigue montada para conservar su estado: que no
    // siga además preguntándole al motor.
    enabled: active,
    refetchInterval: active ? 30_000 : false,
  });

  const items = runs.data?.items ?? [];
  const pendientes = items.filter(
    (run) => (asRecord(run.result) as Partial<IdentityOutcome>).decision === 'REVIEW_REQUIRED',
  );
  const total = runs.data?.total ?? items.length;

  return (
    <div className="worker-console">
      <Panel
        title="Pendientes de revisión humana"
        meta={pendientes.length > 0 ? `${String(pendientes.length)} por decidir` : undefined}
      >
        <p className="field-help">
          Verificaciones cuyo parecido quedó entre los dos umbrales calibrados. El motor no las
          resuelve a la fuerza: las deja aquí para que una persona mire la evidencia y decida. Las
          imágenes ya no existen —se borran al cerrar la ejecución—, así que lo que hay para juzgar
          es esta evidencia.
        </p>

        {runs.isPending && active ? (
          <p className="categoria-vacio">Cargando las verificaciones…</p>
        ) : runs.isError ? (
          <p className="categoria-vacio">No se pudieron leer las verificaciones del motor.</p>
        ) : pendientes.length === 0 ? (
          <p className="categoria-vacio">
            {total > items.length
              ? `Nada pendiente entre las ${String(items.length)} verificaciones más recientes (hay ${String(total)} en total).`
              : 'No hay verificaciones esperando a una persona.'}
          </p>
        ) : (
          <ul className="identity-review-list">
            {pendientes.map((run) => (
              <CasoPendiente key={run.requestId} run={run} />
            ))}
          </ul>
        )}

        {pendientes.length > 0 && total > items.length ? (
          <p className="field-help">
            Se revisaron las {String(items.length)} verificaciones más recientes de {String(total)}:
            puede haber casos más antiguos que no aparecen aquí.
          </p>
        ) : null}
      </Panel>
    </div>
  );
}

/**
 * Un caso, plegado sobre lo que hace falta para priorizar: cuándo fue, qué
 * parecido midió y por qué no se decidió solo. El veredicto entero —campos
 * leídos, calidad, proveedores— se abre debajo, con la misma vista que usa la
 * consola: dos formas de pintar el mismo resultado divergirían a la primera
 * mejora.
 */
function CasoPendiente({ run }: { run: WorkerRun }) {
  const outcome = asRecord(run.result) as Partial<IdentityOutcome>;
  const reasons = asStrings(outcome.reasonCodes);
  const similarity = outcome.faceMatch?.similarityScore;

  return (
    <li className="identity-review-item">
      <details>
        <summary>
          <StatusBadge value="WARNING" labels={{ WARNING: 'Requiere revisión' }} />
          <span className="identity-review-when">
            {run.finishedAt ? formatDateTime(run.finishedAt) : formatDateTime(run.queuedAt)}
          </span>
          <span className="identity-review-similarity">
            {typeof similarity === 'number'
              ? `Parecido ${String(Math.round(similarity * 100))} %`
              : 'Sin parecido medido'}
          </span>
          <span className="identity-review-reasons">
            {reasons.length > 0
              ? reasons.map((code) => REASON_LABEL[code] ?? code).join(' · ')
              : 'Sin motivos declarados'}
          </span>
        </summary>
        <IdentityResultView result={run.result} />
        <div className="worker-run-actions">
          <button
            type="button"
            className="button button-ghost"
            onClick={() => downloadRunTrace(WORKER, run)}
          >
            <FileJson size={15} aria-hidden="true" /> Descargar traza (.json)
          </button>
        </div>
        <p className="field-help">
          Solicitud <code>{run.requestId}</code> · correlación <code>{run.correlationId}</code>
        </p>
      </details>
    </li>
  );
}
