import { useMutation } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { ApiError } from '../../api/ApiError';
import { apiRequest } from '../../api/http-client';
import { useNotifications } from '../../notifications/useNotifications';
import { idempotencyHeaders, newIdempotencyKey } from './idempotency';

export type Decision = 'APPROVE' | 'REJECT';

interface DecisionInput {
  stepId: string;
  decision: Decision;
  comments: string;
}

interface UseApprovalDecisionOptions {
  requestLabel: string;
  /** Se llama cuando el estado del servidor pudo cambiar y hay que releerlo. */
  refresh: () => void;
}

/**
 * Registra la decisión de un paso de aprobación.
 *
 * Dos cosas que la versión anterior no hacía y que un flujo gobernado necesita:
 *
 * - **Idempotencia**: la clave se fija al abrir la confirmación y se reutiliza en
 *   los reintentos del mismo intento, para que un tiempo agotado seguido de un
 *   segundo clic no firme dos veces el mismo paso. El backend tiene que honrar
 *   la cabecera para que sirva; enviarla es la mitad que depende de este lado.
 * - **409**: un conflicto no es un error del formulario. Significa que alguien
 *   movió la solicitud mientras la mirabas, así que se relee el estado real y se
 *   explica en la propia vista, en lugar de dejar al revisor decidiendo sobre
 *   datos que ya no son ciertos.
 *
 * El aviso del fallo lo emite `MutationCache` (QueryProvider); aquí sólo se
 * añade el toast de éxito y la señal de conflicto que la página pinta.
 */
export function useApprovalDecision({ requestLabel, refresh }: UseApprovalDecisionOptions) {
  const { notify } = useNotifications();
  const [staleState, setStaleState] = useState(false);
  // Sobrevive a los re-renders del reintento; se renueva por intento, no por clic.
  const attemptKey = useRef<string | null>(null);

  /** Empieza un intento nuevo: la próxima decisión no reutiliza la clave anterior. */
  const beginAttempt = () => {
    attemptKey.current = newIdempotencyKey('approval-decision');
    setStaleState(false);
  };

  const mutation = useMutation({
    mutationFn: ({ stepId, decision, comments }: DecisionInput) => {
      if (!attemptKey.current) beginAttempt();
      return apiRequest(`/v1/approval-steps/${encodeURIComponent(stepId)}/decisions`, {
        method: 'POST',
        headers: idempotencyHeaders(attemptKey.current as string),
        body: { decision, comments, evidence: [] },
      });
    },
    onSuccess: (_data, { decision }) => {
      attemptKey.current = null;
      refresh();
      notify({
        tone: decision === 'APPROVE' ? 'success' : 'warning',
        title:
          decision === 'APPROVE'
            ? 'Decisión registrada: aprobada'
            : 'Decisión registrada: rechazada',
        description: `${requestLabel} quedó firmado en la bitácora de auditoría.`,
      });
    },
    onError: (error) => {
      if (!(error instanceof ApiError)) return;
      if (error.kind !== 'conflict' && error.kind !== 'forbidden') return;
      // El paso ya no es el que se estaba decidiendo: la clave vieja no aplica.
      attemptKey.current = null;
      setStaleState(true);
      refresh();
    },
  });

  return { ...mutation, beginAttempt, staleState };
}
