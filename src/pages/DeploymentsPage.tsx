'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { canPromoteToEnvironment, canProposeArtifactChange } from '../auth/business-rules';
import { useEffectiveRoles } from '../auth/useAuth';
import { hasAnyRole } from '../auth/roles';
import type { RowAction } from '../components/DataTable';
import { DeploymentCreateForm } from '../features/deployments/DeploymentCreateForm';
import {
  DeploymentControlDialog,
  type DeploymentControlKind,
} from '../features/deployments/DeploymentControlDialog';
import { esAccionable } from '../features/deployments/deployment-controls.api';
import { resources } from '../resources/resource.config';
import { ResourceListPage } from './ResourceListPage';

interface Objetivo {
  kind: DeploymentControlKind;
  deploymentId: string;
  descripcion: string;
}

/** Texto de la fila para el diálogo: sin esto, sólo se ve un identificador. */
function describir(row: Record<string, unknown>): string {
  const version = row.artifactVersion as Record<string, unknown> | undefined;
  const artefacto = (version?.artifact as Record<string, unknown> | undefined)?.artifactCode;
  const numero = version?.versionNumber;
  const ambiente = (row.environment as Record<string, unknown> | undefined)?.code;
  const partes = [artefacto, numero ? `v${String(numero)}` : undefined, ambiente]
    .filter(Boolean)
    .map(String);
  return partes.length ? partes.join(' · ') : String(row.id ?? '');
}

export function DeploymentsPage() {
  const [creating, setCreating] = useState(false);
  const [objetivo, setObjetivo] = useState<Objetivo | null>(null);
  const roles = useEffectiveRoles();
  const queryClient = useQueryClient();

  // Abrir el formulario ya no exige ser administrador: quien propone cambios
  // promueve a los ambientes de trabajo. Es el ambiente elegido dentro del
  // formulario el que decide si hace falta un Platform Admin.
  const canCreate = canProposeArtifactChange(roles);
  const canPromoteToProduction = canPromoteToEnvironment(roles, {
    code: 'PROD',
    isProduction: true,
  });

  /*
   * Revertir y suspender los reserva el motor a `PLATFORM_ADMIN`.
   *
   * Se comprueba aquí también, y no para sustituir al motor —que revalida siempre— sino para no
   * ofrecer un control que va a responder 403. Un botón que sólo sirve para recibir un rechazo
   * enseña a desconfiar de los botones.
   */
  const puedeIntervenir = hasAnyRole(roles, ['PLATFORM_ADMIN']);

  /**
   * Acciones por fila.
   *
   * Sólo sobre despliegues VIVOS. Revertir algo ya revertido, suspendido o sustituido no es un
   * error que convenga dejar que el usuario descubra con un 409: es una acción sin sentido, y
   * ofrecerla sugiere que lo tiene. Sobre el resto, la fila conserva su enlace a detalle.
   */
  function accionesDeFila(row: Record<string, unknown>): RowAction[] {
    if (!puedeIntervenir || !esAccionable(row.status)) return [];
    const deploymentId = String(row.id ?? '');
    const descripcion = describir(row);
    return [
      {
        action: 'rollback',
        label: `Revertir el despliegue ${descripcion}`,
        onClick: () => setObjetivo({ kind: 'rollback', deploymentId, descripcion }),
      },
      {
        action: 'suspend',
        label: `Suspender el despliegue ${descripcion}`,
        onClick: () => setObjetivo({ kind: 'suspend', deploymentId, descripcion }),
      },
    ];
  }

  return (
    <>
      <ResourceListPage
        config={resources.deployments}
        onPrimaryAction={() => setCreating(true)}
        primaryActionDisabled={!canCreate}
        primaryActionTitle={
          !canCreate
            ? 'Requiere rol QA Analyst, Fraud Analyst o Platform Admin'
            : canPromoteToProduction
              ? 'Promover una versión aprobada a cualquier ambiente'
              : 'Promover una versión a un ambiente de trabajo; producción requiere Platform Admin'
        }
        rowActions={accionesDeFila}
      />
      {creating ? <DeploymentCreateForm onClose={() => setCreating(false)} /> : null}
      {objetivo ? (
        <DeploymentControlDialog
          kind={objetivo.kind}
          deploymentId={objetivo.deploymentId}
          descripcion={objetivo.descripcion}
          onClose={() => setObjetivo(null)}
          // El listado se refresca entero: el estado de la fila cambia y, en una reversión,
          // también el del despliegue que vuelve a quedar activo. Invalidar sólo la fila
          // accionada dejaría la otra mintiendo.
          onDone={() =>
            void queryClient.invalidateQueries({ queryKey: ['resource', 'deployments'] })
          }
        />
      ) : null}
    </>
  );
}
