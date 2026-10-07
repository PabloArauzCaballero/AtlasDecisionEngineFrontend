import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../api/http-client';
import { useNotifications } from '../../notifications/useNotifications';

interface GeneratedSuite {
  cases?: number;
  complete?: boolean;
  nodes?: { percentage?: number; missing?: Array<{ key?: string; label?: string }> };
}

/**
 * Generar la suite de cobertura de la versión: el motor busca los casos que recorren todo el diagrama, los
 * guarda como suite bloqueante y la ejecuta. Es lo que hace que «no tiene pruebas» deje de ser un callejón.
 */
export function useGenerateCoverageSuite(versionId: string) {
  const queryClient = useQueryClient();
  const { notify } = useNotifications();
  return useMutation({
    mutationFn: () =>
      apiRequest<GeneratedSuite>(
        `/v1/artifact-versions/${encodeURIComponent(versionId)}/test-suites/generate`,
        { method: 'POST', body: {} },
      ),
    onSuccess: async (generated) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['review-readiness', versionId] }),
        queryClient.invalidateQueries({ queryKey: ['test-suites', versionId] }),
      ]);
      const percentage = String(generated.nodes?.percentage ?? '—');
      notify(
        generated.complete
          ? {
              tone: 'success',
              title: `Pruebas generadas: ${String(generated.cases ?? 0)} casos`,
              description: `Recorren el ${percentage} % del diagrama. Se están ejecutando; en unos segundos la lista se pone en verde.`,
            }
          : {
              tone: 'warning',
              title: `Pruebas generadas, pero no llegan a todo el diagrama (${percentage} %)`,
              description:
                'Algunos nodos no se dejan alcanzar con ninguna entrada válida. Revisa esos nodos en el diagrama.',
            },
      );
    },
  });
}
