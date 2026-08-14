'use client';

import { WorkersPage } from '../../../../pages/WorkersPage';

/** Enlace directo al worker de identidad. Ver la nota del worker semántico. */
export default function IdentityVerificationWorkerRoute() {
  return <WorkersPage initialWorker="identity-verification" />;
}
