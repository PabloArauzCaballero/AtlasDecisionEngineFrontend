'use client';

import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { Panel } from '../../components/Panel';
import { conflictingHeads } from './environment-heads';
import { useArtifactHeads } from './useArtifactHeads';

interface EnvironmentHeadsPanelProps {
  artifactCode: string;
}

/**
 * Qué versión está vigente en cada ambiente, según los despliegues activos.
 *
 * Responde la pregunta que la ficha del artefacto no respondía: «¿qué está
 * decidiendo ahora mismo en producción?». El backend filtra por `artifactCode`,
 * así que no se traen todos los despliegues para descartarlos en el cliente.
 */
export function EnvironmentHeadsPanel({ artifactCode }: EnvironmentHeadsPanelProps) {
  const query = useArtifactHeads(artifactCode);
  const { enabled, heads } = query;
  const broken = conflictingHeads(heads);

  return (
    <Panel title="Versión vigente por ambiente" meta="Despliegues activos">
      {!enabled ? (
        <div className="empty-state">El artefacto no expone un código con el que consultar.</div>
      ) : query.isPending ? (
        <div className="empty-state">Consultando despliegues…</div>
      ) : query.isError ? (
        <div className="empty-state">
          No fue posible consultar los despliegues, así que no se puede afirmar qué versión está
          vigente.
        </div>
      ) : !heads.length ? (
        <div className="empty-state">
          Ningún despliegue activo: este artefacto todavía no decide en ningún ambiente.
        </div>
      ) : (
        <ul className="environment-heads">
          {heads.map((head) => (
            <li key={head.environmentCode} data-conflict={head.activeCount > 1 ? 'yes' : 'no'}>
              <code>{head.environmentCode}</code>
              <div>
                <strong>
                  {head.versionId ? (
                    <Link href={`/artifact-versions/${head.versionId}/graph`}>
                      v{head.versionLabel}
                    </Link>
                  ) : (
                    `v${head.versionLabel}`
                  )}
                </strong>
                <small>
                  {head.deployedBy} · {head.deployedAt}
                </small>
              </div>
              {head.activeCount > 1 ? (
                <span className="head-conflict" title="Más de una versión activa en este ambiente">
                  <AlertTriangle size={15} /> {head.activeCount} activas
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {broken.length ? (
        <p className="decision-warning">
          {broken.length === 1
            ? `El ambiente ${broken[0].environmentCode} tiene ${broken[0].activeCount} versiones activas a la vez.`
            : `${broken.length} ambientes tienen más de una versión activa a la vez.`}{' '}
          Un ambiente sólo puede tener una: repórtalo antes de desplegar encima.
        </p>
      ) : null}
    </Panel>
  );
}
