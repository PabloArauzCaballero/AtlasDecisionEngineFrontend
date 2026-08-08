'use client';

import { WorkersPage } from '../../../../pages/WorkersPage';

/** Enlace directo al worker de extractos. Ver la nota del worker semántico. */
export default function BankStatementWorkerRoute() {
  return <WorkersPage initialWorker="bank-statement" />;
}
