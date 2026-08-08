import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../api/http-client';
import { asRecord, asRows, type UnknownRecord } from '../../utils/records';
import { isPassingGate, readGates, type GateReport } from './approval-gates';
import { evidenceGateRows } from './version-evidence';

/**
 * Gates de una solicitud, con la evidencia que el backend sí publica.
 *
 * Orden de preferencia, y ninguno inventa nada:
 *
 * 1. Un bloque `gates`/`qualityGates`/… en la respuesta, si algún día llega.
 * 2. La evidencia real de la versión: sus suites con sus corridas recientes
 *    (`GET /v1/artifact-versions/:id/test-suites`) y su compilación.
 * 3. Nada: `reported: false`, y la pantalla vuelve a decir que no puede afirmar
 *    que las comprobaciones hayan pasado.
 *
 * El paso 2 puede fallar por permisos —la lectura de suites no admite
 * `RISK_APPROVER`, que es justo el rol que suele firmar—. Un fallo NO se
 * convierte en una lista vacía optimista: se cae al paso 3, que es la verdad
 * («no lo sé»), y se distingue con `deniedEvidence` para poder explicar por qué.
 */
export function useVersionGates(request: UnknownRecord, version: UnknownRecord) {
  const declared = readGates(request, version);
  const versionId = String(version.id ?? '');
  const enabled = !declared.reported && Boolean(versionId);

  const suites = useQuery({
    queryKey: ['version-test-evidence', versionId],
    queryFn: ({ signal }) =>
      apiRequest<unknown>(
        `/v1/artifact-versions/${encodeURIComponent(versionId)}/test-suites?page=1&pageSize=50`,
        { signal },
      ),
    enabled,
    // Un 403 por rol no se reintenta: la respuesta no va a cambiar.
    retry: false,
  });

  /*
   * La versión que viene dentro de la solicitud NO trae `compiledArtifacts`:
   * `getRequest()` la incluye con `include: { artifact: true }` y nada más. El
   * detalle de la versión sí los trae, ordenados por fecha, con su
   * `compileStatus` real. Sin esta segunda consulta no habría con qué respaldar
   * la fila de compilación — y sin respaldo no se pinta.
   */
  const detail = useQuery({
    queryKey: ['version-compile-evidence', versionId],
    queryFn: ({ signal }) =>
      apiRequest<unknown>(`/v1/artifact-versions/${encodeURIComponent(versionId)}`, { signal }),
    enabled,
    retry: false,
  });

  if (declared.reported) return { gates: declared, loading: false, deniedEvidence: false };

  const payload = suites.data;
  const rows = evidenceGateRows(
    { ...version, ...asRecord(detail.data) },
    Array.isArray(payload) ? asRows(payload) : asRows(asRecord(payload).items),
  );

  const gates: GateReport = rows.length
    ? { rows, reported: true, failing: rows.filter((row) => !isPassingGate(row.status)) }
    : { rows: [], reported: false, failing: [] };

  return {
    gates,
    loading: enabled && (suites.isPending || detail.isPending),
    // Si NINGUNA de las dos lecturas de evidencia salió, el vacío es de
    // permisos y no de contenido: se dice cuál de las dos cosas es.
    deniedEvidence: enabled && suites.isError && detail.isError,
  };
}
