import { CheckCircle2, UserCheck } from 'lucide-react';
import { useState } from 'react';
import { errorMessage } from '../api/ApiError';
import { useAuth } from '../auth/useAuth';
import { Alert } from '../components/Alert';
import { ModalDialog } from '../components/ModalDialog';
import { DefinitionGrid } from '../components/DefinitionGrid';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { Timeline } from '../components/Timeline';
import { CaseEvidencePanel } from '../features/manual-review/CaseEvidencePanel';
import { CaseFilePanel } from '../features/manual-review/CaseFilePanel';
import { CaseImagesPanel } from '../features/manual-review/CaseImagesPanel';
import { OnboardingDossierPanel } from '../features/manual-review/OnboardingDossierPanel';
import { useManualReviewActions } from '../features/manual-review/useManualReviewActions';
import { useInteractiveTutorial } from '../features/tutorial/useInteractiveTutorial';
import { useDetailQuery } from '../hooks/useDetailQuery';
import { useNotifications } from '../notifications/useNotifications';
import { asRecord, display, resolvePath } from '../utils/records';
import { Field } from '../components/Field';
import { OptionSelect } from '../components/OptionSelect';
import {
  CASE_STATUS_LABEL,
  CLOSED_CASE_STATUSES,
  RESOLUTION_LABEL,
  RESOLUTION_OPTIONS,
  RESOLUTION_OUTCOME_TEXT,
  type ManualReviewDecision,
} from '../features/manual-review/resolution-options';

interface ManualReviewDetailPageProps {
  caseId: string;
}

export function ManualReviewDetailPage({ caseId }: ManualReviewDetailPageProps) {
  // Sin decisión previa: un caso de revisión manual no puede llegar con la
  // respuesta ya puesta. Preseleccionar «Aprobar» convierte un descuido —pulsar
  // sin leer— en una aprobación con nombre y apellidos en la auditoría.
  const [resolution, setResolution] = useState('');
  const [comments, setComments] = useState('');
  /*
    La confirmacion de que la decision QUEDO REGISTRADA en el motor.
    
    Antes solo habia un aviso efimero en una esquina: el analista pulsaba «Registrar la decision», la
    pantalla se refrescaba y no habia nada que dijera con claridad que el caso se cerro ni con que
    desenlace. En una decision que afecta a la identidad de una persona, «parece que fue» no basta:
    se confirma explicitamente y hay que cerrarlo a mano.
  */
  const [decisionRegistrada, setDecisionRegistrada] = useState<ManualReviewDecision | null>(null);
  const { notify } = useNotifications();
  const { startForError } = useInteractiveTutorial();
  const query = useDetailQuery<unknown>(
    'manual-review',
    caseId ? `/v1/manual-reviews/${encodeURIComponent(caseId)}` : null,
  );
  const review = asRecord(query.data);
  // El caso cerrado no admite resolución ni asignación: el motor contesta 409 `MANUAL_REVIEW_CLOSED`.
  const status = String(review.status ?? '');
  const cerrado = CLOSED_CASE_STATUSES.includes(status);
  /*
   * La ficha lee claves del CASO, pero el artefacto vive dentro de la ejecución
   * (`execution.artifactVersion.artifact.artifactCode`) y el motor no guarda «referencia del cliente»
   * ni `slaDueAt` (el plazo es `dueAt`): esas filas salían siempre «—».
   */
  const ficha = {
    ...review,
    artifactCode: resolvePath(review, 'execution.artifactVersion.artifact.artifactCode'),
    requestId: resolvePath(review, 'execution.requestId'),
  };
  const { user } = useAuth();
  // Ofrecer «asignármelo» sobre un caso que ya es mío no hace nada y sugiere que sí.
  const yaEsMio =
    Boolean(user?.email) && String(review.assignedTo ?? '') === String(user?.email ?? '');
  // El caso puede traer la ejecución anidada o sólo su identificador plano.
  const executionId = String(
    resolvePath(review, 'execution.id') ?? review.executionId ?? review.decisionExecutionId ?? '',
  );
  /*
   * La evidencia viaja en `evidenceJson`. Se lee de forma tolerante porque el nombre del campo
   * depende de quién sirva el caso, y una clave distinta no puede dejar al analista sin datos.
   */
  const evidencia = asRecord(
    resolvePath(review, 'evidenceJson') ?? resolvePath(review, 'evidence'),
  );
  /*
   * El `correlationId` del caso es el ID del INTENTO de verificacion en AtlasBackend, que es el
   * unico hilo que lleva desde aqui hasta las imagenes: el motor solo conserva su hash.
   */
  const attemptId = String(
    resolvePath(review, 'execution.correlationId') ?? resolvePath(review, 'correlationId') ?? '',
  );
  /*
   * Las dos escrituras viven en `useManualReviewActions`: son lo único que esta pantalla manda
   * al motor, y arrastran las trampas de contrato que allí están documentadas.
   */
  const { assign, resolve } = useManualReviewActions({
    caseId,
    review,
    resolution,
    comments,
    notify,
    startForError,
    refetch: () => void query.refetch(),
    onResolved: (decision) => {
      setDecisionRegistrada(decision);
      setComments('');
    },
    resolutionLabel: RESOLUTION_LABEL,
  });

  return (
    <>
      <PageHeader
        eyebrow="F5-04 · Revisión manual"
        title={`Caso #REV-${display(review, 'id')}`}
        description={`${display(review, 'queueCode')} · ${display(review, 'caseCode')}`}
        actions={
          <>
            <button
              className="button"
              type="button"
              disabled={!user?.email || assign.isPending || yaEsMio || cerrado}
              title={
                cerrado
                  ? 'Este caso ya está cerrado'
                  : yaEsMio
                    ? 'Este caso ya está a tu nombre'
                    : 'Tomar este caso: queda a tu nombre en el registro'
              }
              onClick={() => assign.mutate()}
            >
              <UserCheck size={16} /> {assign.isPending ? 'Asignando…' : 'Asignármelo'}
            </button>
          </>
        }
      />
      {decisionRegistrada ? (
        <ModalDialog
          title="Resolución registrada en el motor de decisiones"
          subtitle={`El caso #REV-${display(review, 'id')} ${RESOLUTION_OUTCOME_TEXT[decisionRegistrada]}`}
          icon={<CheckCircle2 size={20} />}
          actions={
            <button
              className="button button--primary"
              type="button"
              onClick={() => setDecisionRegistrada(null)}
            >
              Entendido
            </button>
          }
          onClose={() => setDecisionRegistrada(null)}
        >
          <p>
            {RESOLUTION_LABEL[decisionRegistrada] === 'cancelado'
              ? 'El motivo quedó anotado con tu nombre. '
              : 'La decisión quedó anotada con tu nombre y con el comentario que escribiste. '}
            La auditoría de la transacción es inmutable: quien la revise después verá quién decidió,
            cuándo y con qué evidencia delante.
          </p>
        </ModalDialog>
      ) : null}
      {query.isError || resolve.isError ? (
        <Alert tone="error">{errorMessage(query.error ?? resolve.error)}</Alert>
      ) : null}
      <div className="review-detail-grid">
        <div>
          <Panel
            title="Datos del caso"
            meta={CASE_STATUS_LABEL[status] ?? display(review, 'status')}
          >
            <DefinitionGrid
              record={ficha}
              items={[
                { label: 'Prioridad', keys: ['priority'] },
                { label: 'Cola', keys: ['queueCode'] },
                { label: 'Artefacto', keys: ['artifactCode'] },
                { label: 'Ejecución (request ID)', keys: ['requestId'], mono: true },
                { label: 'Asignado a', keys: ['assignedTo'] },
                { label: 'Vence (SLA)', keys: ['dueAt'] },
              ]}
            />
          </Panel>
          {/*
            La evidencia con la que llegó el caso, que es lo que hay que MIRAR para decidir: TODAS
            sus claves (las de comportamiento incluidas), y aparte el expediente del alta que
            adjunta AtlasBackend —cronómetro, teléfono, ubicación, agenda, lo declarado frente al
            carnet—. Pedir una decisión humana sin enseñar la evidencia es pedir una firma, no un
            criterio.
          */}
          <CaseEvidencePanel evidence={evidencia} />
          <OnboardingDossierPanel evidence={evidencia} />
          <Panel title="Auditoría de la transacción" meta="inmutable">
            <Timeline
              items={[
                {
                  title: 'Decisión ejecutada',
                  detail: display(asRecord(review.execution), 'businessOutcome'),
                  meta: display(asRecord(review.execution), 'executedAt'),
                },
                {
                  title: 'Caso derivado a revisión manual',
                  detail: display(review, 'queueCode'),
                  meta: display(review, 'createdAt'),
                },
                ...(cerrado
                  ? [
                      {
                        title: `Caso ${CASE_STATUS_LABEL[status]?.toLowerCase() ?? status}`,
                        detail: display(asRecord(review.resolutionJson), 'reason'),
                        meta: display(review, 'resolvedAt'),
                      },
                    ]
                  : []),
              ]}
            />
          </Panel>
          {/*
            El expediente completo —quién es el solicitante, con qué datos se
            decidió y por qué motivos— es lo que el analista de riesgo necesita
            para valorar el caso. Antes sólo había una instantánea cruda.
          */}
          <CaseImagesPanel attemptId={attemptId} />
          <CaseFilePanel executionId={executionId} />
        </div>
        <div data-tutorial-id="review-resolution">
          <Panel title="Resolver el caso" meta={cerrado ? 'cerrado' : 'obligatorio'}>
            {cerrado ? (
              <Alert tone="info">
                Este caso ya está cerrado ({CASE_STATUS_LABEL[status]?.toLowerCase() ?? status}) y
                no admite otra resolución.
              </Alert>
            ) : null}
            <Field label={'Decisión'} tooltip="Cómo se resuelve este caso de revisión manual.">
              <OptionSelect
                name="resolucion"
                value={resolution}
                onChange={setResolution}
                placeholder="Elegir una decisión…"
                options={RESOLUTION_OPTIONS}
              />
            </Field>
            <Field
              label="Comentarios (obligatorios)"
              tooltip="Por qué resuelves así el caso; queda con la resolución."
            >
              <textarea
                rows={8}
                value={comments}
                onChange={(event) => setComments(event.target.value)}
              />
            </Field>
            <button
              className="button button-primary full-width"
              disabled={!resolution || !comments || !caseId || resolve.isPending || cerrado}
              onClick={() => resolve.mutate()}
              type="button"
            >
              {resolve.isPending ? (
                <span className="inline-spinner" aria-hidden="true" />
              ) : (
                <CheckCircle2 size={16} />
              )}
              {resolve.isPending ? 'Enviando…' : 'Registrar la decisión'}
            </button>
          </Panel>
        </div>
      </div>
    </>
  );
}
