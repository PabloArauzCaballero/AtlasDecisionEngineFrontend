import { useState } from 'react';
import { useAuth } from '../auth/useAuth';
import { hasAnyRole } from '../auth/roles';
import { ObjectiveCreateDialog } from '../features/objectives/ObjectiveCreateDialog';
import { resources } from '../resources/resource.config';
import { ResourceListPage } from './ResourceListPage';

export function ObjectivesPage() {
  const { user } = useAuth();
  const [creating, setCreating] = useState(false);
  const canCreate = hasAnyRole(user?.roles ?? [], ['RISK_ANALYST', 'COMPLIANCE']);

  return (
    <>
      <ResourceListPage
        config={resources.objectives}
        onPrimaryAction={() => setCreating(true)}
        primaryActionDisabled={!canCreate}
        primaryActionTitle={
          canCreate ? 'Crear un objetivo de negocio' : 'Requiere rol Risk Analyst o Compliance'
        }
      />
      {creating ? <ObjectiveCreateDialog onClose={() => setCreating(false)} /> : null}
    </>
  );
}
