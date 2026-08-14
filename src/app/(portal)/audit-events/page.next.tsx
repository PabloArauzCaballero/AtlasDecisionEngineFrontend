'use client';

import { AuditIntegrityPanel } from '../../../features/audit/AuditIntegrityPanel';
import { ResourceListPage } from '../../../pages/ResourceListPage';
import { resources } from '../../../resources/resource.config';

/**
 * El registro de auditoría, con su comprobación de integridad ARRIBA.
 *
 * Antes de la lista y no al final: quien entra aquí viene a mirar hechos registrados, y lo
 * primero que hay que poder afirmar es que ese registro no fue alterado. Al pie, la comprobación
 * se convierte en una nota que nadie desplaza para leer.
 */
export default function AuditEventsRoute() {
  return (
    <>
      <AuditIntegrityPanel />
      <ResourceListPage config={resources['audit-events']} />
    </>
  );
}
