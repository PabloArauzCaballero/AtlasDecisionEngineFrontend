import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, errorMessage } from '../../api/ApiError';
import { apiRequest } from '../../api/http-client';
import { canProposeArtifactChange } from '../../auth/business-rules';
import { useEffectiveRoles } from '../../auth/useAuth';
import { useNotifications } from '../../notifications/useNotifications';
import { asRecord, display, type UnknownRecord } from '../../utils/records';
import { explainSubmitError } from './submit-review';

/**
 * Enviar una versión a revisión, para las dos pantallas que lo ofrecen: la bandeja de Revisiones y «Validar y
 * compilar». Una sola implementación para que el motivo de un rechazo se diga igual en las dos.
 */
export function useSubmitForReview(versionId: string) {
  const queryClient = useQueryClient();
  const { notify } = useNotifications();
  const canPropose = canProposeArtifactChange(useEffectiveRoles());

  const mutation = useMutation({
    mutationFn: () =>
      apiRequest<UnknownRecord>(
        `/v1/artifact-versions/${encodeURIComponent(versionId)}/submit-for-review`,
        {
          method: 'POST',
          body: { requireCompliance: true },
        },
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['resource', 'reviews'] }),
        queryClient.invalidateQueries({ queryKey: ['submit-review-version', versionId] }),
        queryClient.invalidateQueries({ queryKey: ['artifact-version', versionId] }),
      ]);
      notify({
        tone: 'success',
        title: 'Versión enviada a revisión',
        description:
          'Ahora la firman Calidad, Riesgo y Cumplimiento. Tú no puedes aprobar la tuya.',
      });
    },
  });

  const requestId = mutation.data ? display(asRecord(mutation.data), 'id') : '—';
  return {
    canPropose,
    pending: mutation.isPending,
    submit: () => mutation.mutate(),
    reset: () => mutation.reset(),
    /** Id de la solicitud creada, o `null` mientras no haya ninguna. */
    requestId: requestId === '—' ? null : requestId,
    /** El motivo del rechazo, en lenguaje llano. */
    problem: mutation.error
      ? (explainSubmitError(mutation.error instanceof ApiError ? mutation.error.code : undefined) ??
        errorMessage(mutation.error))
      : null,
  };
}
