import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '../../api/http-client';
import { notifyApiError } from '../tutorial/error-tutorial';
import { display } from '../../utils/records';
import type { useNotifications } from '../../notifications/useNotifications';
import type { useInteractiveTutorial } from '../tutorial/useInteractiveTutorial';

/**
 * Las dos escrituras de la revisión manual: tomar el caso y resolverlo.
 *
 * Salen de `ManualReviewDetailPage` porque la página cruzó el tope de 299 líneas del
 * repositorio, pero el corte no es por tamaño: son lo único de esa pantalla que ESCRIBE, y las
 * dos comparten el mismo puñado de trampas de contrato con el motor —documentadas abajo— que no
 * se deducen mirando el formulario. Separadas, la página queda siendo lo que pinta y esto queda
 * siendo lo que hace, que es el corte que aguanta cuando mañana se añada un tercer botón.
 *
 * `meta.handled` en las dos: esta vista enseña el fallo ella misma y con acceso al tutorial que
 * enseña a corregirlo. Sin la marca, el aviso global de `QueryProvider` contaría el mismo
 * suceso una segunda vez con un texto genérico.
 */
interface AccionesInput {
  caseId: string;
  review: Record<string, unknown>;
  resolution: string;
  comments: string;
  /*
   * Los dos se DERIVAN de sus hooks en vez de reescribirse aquí.
   *
   * Escritos a mano quedaban parecidos pero no iguales —`tone` como `string` en vez del literal,
   * `startForError` recibiendo `unknown` en vez del código—, y un tipo «parecido» en un borde es
   * peor que ninguno: compila, y deja pasar un tono que la banda de avisos no sabe pintar.
   */
  notify: ReturnType<typeof useNotifications>['notify'];
  startForError: ReturnType<typeof useInteractiveTutorial>['startForError'];
  refetch: () => void;
  onResolved: (outcome: string) => void;
  resolutionLabel: Record<string, string>;
}

export function useManualReviewActions({
  caseId,
  review,
  resolution,
  comments,
  notify,
  startForError,
  refetch,
  onResolved,
  resolutionLabel,
}: AccionesInput) {
  /*
   * Asignarse el caso.
   *
   * El motor publica `POST /v1/manual-reviews/{id}/assign` desde hace tiempo y este botón
   * llevaba puesto un `disabled` con el título «aún no está expuesta por el Decision Engine».
   * Lo estaba: el flujo de revisión se podía RESOLVER desde el portal pero no ASIGNAR, así que
   * la mitad que decide quién mira cada caso ocurría fuera y no dejaba traza.
   *
   * Se asigna al correo de la sesión y no a un campo libre: el caso de uso que faltaba es
   * «tomo yo este caso», y un selector de personas invita a repartir trabajo ajeno desde una
   * pantalla que no es la de gestión de colas.
   */
  const assign = useMutation({
    meta: { handled: true },
    mutationFn: () =>
      apiRequest(`/v1/manual-reviews/${encodeURIComponent(caseId)}/assign`, {
        method: 'POST',
        /*
         * Sin `assignedTo`: el caso queda a nombre del PRINCIPAL de la sesion, que es contra quien
         * el motor comprueba despues al resolver. Mandar el correo lo asignaba a una identidad que
         * nunca coincidia, asi que se podia tomar el caso y luego era imposible resolverlo.
         */
        body: {},
      }),
    onSuccess: () => {
      refetch();
      notify({
        tone: 'success',
        title: 'Caso asignado',
        description: `REV-${display(review, 'id')} queda a tu nombre y sale de la cola sin dueño.`,
      });
    },
    onError: (error) => notifyApiError(error, notify, startForError),
  });

  const resolve = useMutation({
    // Esta vista muestra el fallo ella misma, con acceso al tutorial que enseña a
    // corregirlo: sin `handled` el aviso global de QueryProvider lo repetiría.
    meta: { handled: true },
    mutationFn: () =>
      apiRequest(`/v1/manual-reviews/${encodeURIComponent(caseId)}/resolve`, {
        method: 'POST',
        /*
         * El contrato del motor es `{ decision, reason }`, no `{ resolution, comments }`.
         *
         * Con los nombres antiguos, CADA intento de resolver un caso desde esta pantalla moria en un
         * 400 —«property resolution should not exist; decision must be one of APPROVE, DECLINE,
         * CANCEL»— y la interfaz solo decia «No fue posible completar la solicitud». Es decir: el
         * boton de aprobar no habia funcionado nunca desde aqui, y el mensaje generico no daba
         * ninguna pista de por que.
         *
         * Los nombres de la UI se quedan como estan —`resolution` y `comments` describen mejor lo
         * que el analista ve— y la traduccion al contrato ocurre en el borde, que es su sitio.
         */
        body: { decision: resolution, reason: comments },
      }),
    onSuccess: () => {
      // Capture the resolution before clearing, so the toast reports what was
      // actually sent rather than whatever the form holds afterwards.
      const outcome = resolutionLabel[resolution] ?? resolution;
      onResolved(outcome);
      refetch();
      notify({
        tone: resolution === 'APPROVE' ? 'success' : 'info',
        title: `Caso ${outcome}`,
        description: `REV-${display(review, 'id')} se resolvió y salió de la cola.`,
      });
    },
    onError: (error) => notifyApiError(error, notify, startForError),
  });
  return { assign, resolve };
}
