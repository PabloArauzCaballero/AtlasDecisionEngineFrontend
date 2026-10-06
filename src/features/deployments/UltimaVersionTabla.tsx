'use client';

import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../api/http-client';
import { Alert } from '../../components/Alert';
import { DataTable, type TableColumn } from '../../components/DataTable';
import { asRecord, asRows } from '../../utils/records';
import { ultimaVersionPorAlgoritmo, type FilaUltimaVersion } from './ultima-version';

const COLUMNAS: readonly TableColumn<FilaUltimaVersion>[] = [
  { key: 'artifactCode', label: 'Algoritmo', code: true },
  { key: 'ultimaVersion', label: 'Última versión', mono: true },
  {
    key: 'ultimaEstado',
    label: 'Estado',
    status: true,
    labels: {
      APPROVED: 'Aprobada',
      IN_REVIEW: 'En revisión',
      DRAFT: 'Borrador',
      COMPILED: 'Compilada',
      DEPLOYED_TO_STAGING: 'Desplegada en Staging',
      DEPLOYED_TO_PRODUCTION: 'Desplegada en producción',
    },
  },
  { key: 'activa', label: 'Activa ahora', wrap: true },
  { key: 'siguiente', label: 'Qué falta', wrap: true },
];

/**
 * «Última versión de cada algoritmo»: lo que está activo y lo que espera, con «Desplegar» a mano.
 *
 * Va ENCIMA del historial porque responde la pregunta con la que se entra a esta pantalla —«¿qué
 * tengo que desplegar?»—; el historial responde otra, «¿qué pasó?». Ver `ultima-version.ts`.
 *
 * Desplegar abre el MISMO formulario de siempre con la versión ya elegida: el ambiente, el modo y
 * los permisos se deciden donde siempre, y el motor revalida todo al recibirlo.
 */
export function UltimaVersionTabla({ onDeploy }: { onDeploy: (versionId: string) => void }) {
  const query = useQuery({
    queryKey: ['ultima-version-por-algoritmo'],
    queryFn: async ({ signal }) => {
      const [versiones, despliegues] = await Promise.all([
        apiRequest<unknown>('/v1/views/pickers/artifact-versions', { signal }),
        apiRequest<unknown>('/v1/deployments?status=ACTIVE&page=1&pageSize=100', { signal }),
      ]);
      return ultimaVersionPorAlgoritmo(
        asRows(asRecord(versiones).items),
        asRows(asRecord(despliegues).items),
      );
    },
    staleTime: 30_000,
  });

  const filas = query.data ?? [];
  const pendientes = filas.filter((fila) => fila.desplegable).length;

  return (
    <section className="panel" aria-labelledby="ultima-version-title" data-testid="ultima-version">
      <div className="panel-title">
        <h2 id="ultima-version-title">Última versión de cada algoritmo</h2>
        <small>
          {query.isPending
            ? 'Consultando…'
            : pendientes > 0
              ? `${pendientes} ${pendientes === 1 ? 'versión aprobada espera' : 'versiones aprobadas esperan'} despliegue`
              : 'Nada aprobado pendiente de desplegar'}
        </small>
      </div>
      {query.isError ? (
        <Alert tone="warning">
          No pudimos consultar las versiones. El historial de abajo sigue disponible y «Nuevo
          despliegue» también.
        </Alert>
      ) : query.isPending ? (
        <div className="empty-state">Reuniendo la última versión de cada algoritmo…</div>
      ) : filas.length === 0 ? (
        <div className="empty-state">Todavía no hay algoritmos con versiones.</div>
      ) : (
        <DataTable
          rows={filas}
          columns={COLUMNAS}
          getRowKey={(fila) => fila.artifactCode}
          tools={false}
          rowActions={(fila) =>
            fila.desplegable
              ? [
                  {
                    action: 'deploy',
                    label: `Desplegar ${fila.artifactCode} ${fila.ultimaVersion}`,
                    onClick: () => onDeploy(fila.ultimaVersionId),
                  },
                ]
              : []
          }
        />
      )}
    </section>
  );
}
