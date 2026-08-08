import { useState } from 'react';
import { canPromoteToEnvironment, canProposeArtifactChange } from '../auth/business-rules';
import { useAuth } from '../auth/useAuth';
import { DeploymentCreateForm } from '../features/deployments/DeploymentCreateForm';
import { resources } from '../resources/resource.config';
import { ResourceListPage } from './ResourceListPage';

export function DeploymentsPage() {
  const { user } = useAuth();
  const [creating, setCreating] = useState(false);
  const roles = user?.roles ?? [];
  // Abrir el formulario ya no exige ser administrador: quien propone cambios
  // promueve a los ambientes de trabajo. Es el ambiente elegido dentro del
  // formulario el que decide si hace falta un Platform Admin.
  const canCreate = canProposeArtifactChange(roles);
  const canPromoteToProduction = canPromoteToEnvironment(roles, {
    code: 'PROD',
    isProduction: true,
  });

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
      />
      {creating ? <DeploymentCreateForm onClose={() => setCreating(false)} /> : null}
    </>
  );
}
