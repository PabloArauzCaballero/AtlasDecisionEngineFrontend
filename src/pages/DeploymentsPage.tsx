import { useState } from 'react';
import { hasAnyRole } from '../auth/roles';
import { useAuth } from '../auth/useAuth';
import { DeploymentCreateForm } from '../features/deployments/DeploymentCreateForm';
import { resources } from '../resources/resource.config';
import { ResourceListPage } from './ResourceListPage';

export function DeploymentsPage() {
  const { user } = useAuth();
  const [creating, setCreating] = useState(false);
  const canCreate = hasAnyRole(user?.roles ?? [], ['PLATFORM_ADMIN']);

  return (
    <>
      <ResourceListPage
        config={resources.deployments}
        onPrimaryAction={() => setCreating(true)}
        primaryActionDisabled={!canCreate}
        primaryActionTitle={
          canCreate ? 'Promover una versión aprobada a un ambiente' : 'Requiere rol Platform Admin'
        }
      />
      {creating ? <DeploymentCreateForm onClose={() => setCreating(false)} /> : null}
    </>
  );
}
