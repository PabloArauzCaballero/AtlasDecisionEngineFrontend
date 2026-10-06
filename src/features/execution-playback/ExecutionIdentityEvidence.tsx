import { Panel } from '../../components/Panel';
import { asRows, display, resolvePath, type UnknownRecord } from '../../utils/records';
import { ImagenesDeLaEjecucion } from '../workers/IdentityRunImagesPanel';

interface IdentityStep {
  nodeKey: string;
  evidenceRequestId: string | null;
}

/** Pasos de la traza que verificaron una identidad, con la corrida que guarda sus imágenes. */
export function identityStepsOf(traceSteps: unknown): IdentityStep[] {
  return asRows(traceSteps)
    .filter(
      (step) =>
        resolvePath(step, 'evaluationResultJson.worker.service') === 'identity-verification',
    )
    .map((step: UnknownRecord) => {
      const evidence = resolvePath(step, 'evaluationResultJson.worker.evidenceRequestId');
      return {
        nodeKey: display(step, 'nodeKey'),
        evidenceRequestId: typeof evidence === 'string' && evidence ? evidence : null,
      };
    });
}

/**
 * El carnet y la selfie sobre los que decidió cada nodo de identidad de la ejecución.
 *
 * El motor los conserva en una corrida de identidad y deja su `requestId` en la traza del paso
 * (`evaluation.worker.evidenceRequestId`); las imágenes se piden por la puerta autenticada, con la
 * autorización por tenant y rol del motor. Sin pasos de identidad no se pinta nada.
 */
export function ExecutionIdentityEvidence({ traceSteps }: Readonly<{ traceSteps: unknown }>) {
  const steps = identityStepsOf(traceSteps);
  if (!steps.length) return null;
  return (
    <>
      {steps.map((step) => (
        <Panel
          key={step.nodeKey}
          title="Documento de identidad"
          meta={`Paso ${step.nodeKey} · anverso, reverso y selfie`}
        >
          {step.evidenceRequestId ? (
            <ImagenesDeLaEjecucion requestId={step.evidenceRequestId} />
          ) : (
            <p className="field-help">
              Esta verificación no conservó sus imágenes: la ejecución es anterior a que el motor
              las guardara para los nodos del grafo, o el almacén no estaba disponible cuando se
              decidió (la traza lo marca como IDENTITY_EVIDENCE_NOT_KEPT).
            </p>
          )}
        </Panel>
      ))}
    </>
  );
}
