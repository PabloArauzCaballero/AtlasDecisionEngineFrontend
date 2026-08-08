import { useState } from 'react';
import { useAuth } from '../auth/useAuth';
import { OBJECTIVE_AUTHORING_ROLES } from '../auth/business-rules';
import { hasAnyRole } from '../auth/roles';
import { ObjectiveCreateDialog } from '../features/objectives/ObjectiveCreateDialog';
import { resources } from '../resources/resource.config';
import { ResourceListPage } from './ResourceListPage';

export function ObjectivesPage() {
  const { user } = useAuth();
  const [creating, setCreating] = useState(false);
  // El analista de riesgo consulta objetivos y su cobertura, pero no los fija:
  // un objetivo es la vara con la que se mide si un algoritmo cumple.
  const canCreate = hasAnyRole(user?.roles ?? [], OBJECTIVE_AUTHORING_ROLES);

  return (
    <>
      <ResourceListPage
        config={resources.objectives}
        onPrimaryAction={() => setCreating(true)}
        primaryActionDisabled={!canCreate}
        primaryActionTitle={
          canCreate ? 'Crear un objetivo de negocio' : 'Requiere rol Compliance o Platform Admin'
        }
      />
      {creating ? <ObjectiveCreateDialog onClose={() => setCreating(false)} /> : null}
    </>
  );
}
