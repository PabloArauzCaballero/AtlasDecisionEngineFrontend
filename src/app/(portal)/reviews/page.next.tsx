'use client';

import { SubmitForReviewPanel } from '../../../features/governance/SubmitForReviewPanel';
import { ResourceListPage } from '../../../pages/ResourceListPage';
import { resources } from '../../../resources/resource.config';

/**
 * La bandeja lleva encima el envío a revisión. Hasta 2026-10 esta ruta sólo pintaba la tabla y el formulario vivía
 * en una pantalla que ninguna ruta importaba: no había forma de mandar a revisión una versión recién compilada.
 */
export default function ReviewsRoute() {
  return <ResourceListPage config={resources.reviews} intro={<SubmitForReviewPanel />} />;
}
