'use client';

import { useMutation } from '@tanstack/react-query';
import { HelpCircle } from 'lucide-react';
import { useState } from 'react';
import { apiRequest } from '../../api/http-client';
import { Alert } from '../../components/Alert';
import { ModalDialog } from '../../components/ModalDialog';
import { useNotifications } from '../../notifications/useNotifications';
import {
  INFORMATION_SOURCES,
  informationRequestError,
  informationRequestPath,
  isInformationRequestReady,
  type InformationRequestDraft,
} from './information-request';

interface CaseInformationRequestDialogProps {
  caseId: string;
  onClose: () => void;
  /** Se llama al registrar la solicitud, para releer el caso. */
  onRequested: () => void;
}

/**
 * Petición de información adicional sobre un caso.
 *
 * Es la única escritura que el analista de riesgo conserva sobre un artefacto en
 * curso: no cambia ninguna regla ni resuelve nada, deja constancia de qué dato
 * falta y a quién se le pide —incluido el backend central—.
 */
export function CaseInformationRequestDialog({
  caseId,
  onClose,
  onRequested,
}: CaseInformationRequestDialogProps) {
  const { notify } = useNotifications();
  const [draft, setDraft] = useState<InformationRequestDraft>({ source: '', question: '' });
  const chosen = INFORMATION_SOURCES.find((source) => source.value === draft.source);

  const request = useMutation({
    // La vista muestra el fallo con su explicación propia; sin `handled` el
    // aviso global de QueryProvider lo repetiría con el mensaje crudo.
    meta: { handled: true },
    mutationFn: () =>
      apiRequest(informationRequestPath(caseId), {
        method: 'POST',
        body: { source: draft.source, question: draft.question.trim() },
      }),
    onSuccess: () => {
      notify({
        tone: 'success',
        title: 'Solicitud de información registrada',
        description: `Se pidió información a ${chosen?.label ?? draft.source} para el caso REV-${caseId}.`,
      });
      onRequested();
      onClose();
    },
  });

  const ready = isInformationRequestReady(draft);

  return (
    <ModalDialog
      title="Solicitar más información"
      subtitle={`Caso REV-${caseId}`}
      icon={<HelpCircle size={20} />}
      onClose={onClose}
      actions={
        <>
          <button className="button" type="button" disabled={request.isPending} onClick={onClose}>
            Cancelar
          </button>
          <button
            className="button button-primary"
            type="button"
            disabled={!ready || request.isPending}
            onClick={() => request.mutate()}
          >
            {request.isPending ? 'Registrando…' : 'Solicitar información'}
          </button>
        </>
      }
    >
      {request.isError ? (
        <Alert tone="error">{informationRequestError(request.error)}</Alert>
      ) : null}
      <label className="field">
        <span>A quién se le pide</span>
        <select
          value={draft.source}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              source: event.target.value as InformationRequestDraft['source'],
            }))
          }
        >
          <option value="">Elegir origen…</option>
          {INFORMATION_SOURCES.map((source) => (
            <option key={source.value} value={source.value}>
              {source.label}
            </option>
          ))}
        </select>
      </label>
      {chosen ? <p className="muted-note">{chosen.help}</p> : null}
      <label className="field">
        <span>Qué dato falta y para qué</span>
        <textarea
          rows={6}
          value={draft.question}
          placeholder="Ej.: hace falta el histórico de movimientos de los últimos 6 meses para valorar la estabilidad del ingreso declarado."
          onChange={(event) =>
            setDraft((current) => ({ ...current, question: event.target.value }))
          }
        />
      </label>
      {draft.question.trim() && !ready ? (
        <p className="muted-note">
          Describe la petición con algo más de detalle: quien la atienda no ve el caso.
        </p>
      ) : null}
    </ModalDialog>
  );
}
