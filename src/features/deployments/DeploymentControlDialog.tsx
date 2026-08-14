'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { errorMessage } from '../../api/ApiError';
import { Alert } from '../../components/Alert';
import { ModalDialog } from '../../components/ModalDialog';
import { useNotifications } from '../../notifications/useNotifications';
import {
  MAX_REASON_LENGTH,
  MIN_REASON_LENGTH,
  rollbackDeployment,
  suspendDeployment,
} from './deployment-controls.api';

export type DeploymentControlKind = 'rollback' | 'suspend';

interface DeploymentControlDialogProps {
  kind: DeploymentControlKind;
  deploymentId: string;
  /** Para que el diálogo diga sobre QUÉ se está actuando, no sólo un identificador. */
  descripcion: string;
  onClose: () => void;
  onDone: () => void;
}

const TEXTOS: Record<
  DeploymentControlKind,
  { titulo: string; verbo: string; consecuencia: string; ejemplo: string }
> = {
  rollback: {
    titulo: 'Revertir despliegue',
    verbo: 'Revertir',
    consecuencia:
      'Las nuevas decisiones pasarán a resolverse con el despliegue anterior de este ambiente. ' +
      'Lo ya decidido no cambia: una decisión tomada es un hecho registrado y no se reescribe.',
    ejemplo: 'p. ej. «Tasa de rechazo del 61 % desde las 09:40, incidente INC-482»',
  },
  suspend: {
    titulo: 'Suspender despliegue',
    verbo: 'Suspender',
    consecuencia:
      'El despliegue deja de resolver decisiones y su enlace en ejecución se invalida. A ' +
      'diferencia de revertir, NO entra otro en su lugar: el ambiente se queda sin versión ' +
      'activa hasta que alguien promueva una.',
    ejemplo: 'p. ej. «Sospecha de fuga de datos en el nodo de enriquecimiento, ticket SEC-77»',
  },
};

/**
 * El diálogo que faltaba para las dos acciones más graves del portal.
 *
 * Tres decisiones, y las tres vienen del mismo sitio: esto se lee en un incidente, con prisa.
 *
 * 1. **El motivo es obligatorio y con mínimo real.** El motor exige `reason`, pero un campo que
 *    acepta «x» cumple el contrato y no informa a nadie. Diez caracteres no garantizan una buena
 *    explicación; sí impiden la peor, que es la que se escribe para que el botón se encienda.
 *
 * 2. **La consecuencia se dice ANTES, y se dice completa.** Revertir y suspender se parecen y no
 *    son lo mismo: revertir devuelve el ambiente al despliegue anterior, suspender lo deja SIN
 *    versión activa. Confundirlos durante un incidente deja un ambiente mudo cuando lo que se
 *    quería era volver atrás.
 *
 * 3. **Se dice también lo que NO cambia.** Lo ya decidido no se reescribe. Sin esa frase, la
 *    duda razonable —«¿esto deshace las decisiones de esta mañana?»— frena a quien debería
 *    actuar rápido, o peor, le hace no actuar.
 */
export function DeploymentControlDialog({
  kind,
  deploymentId,
  descripcion,
  onClose,
  onDone,
}: DeploymentControlDialogProps) {
  const { notify } = useNotifications();
  const [reason, setReason] = useState('');
  const texto = TEXTOS[kind];

  const recortado = reason.trim();
  const suficiente = recortado.length >= MIN_REASON_LENGTH;
  const excedido = reason.length > MAX_REASON_LENGTH;

  const mutation = useMutation({
    mutationFn: () =>
      kind === 'rollback'
        ? rollbackDeployment(deploymentId, recortado)
        : suspendDeployment(deploymentId, recortado),
    onSuccess: () => {
      // El éxito se anuncia aquí; los errores los reporta `MutationCache` globalmente.
      notify({
        tone: 'success',
        title: kind === 'rollback' ? 'Despliegue revertido.' : 'Despliegue suspendido.',
      });
      onDone();
      onClose();
    },
  });

  return (
    <ModalDialog
      title={texto.titulo}
      subtitle={descripcion}
      tone="danger"
      onClose={onClose}
      actions={
        <>
          <button className="button" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="button button-danger"
            type="button"
            disabled={!suficiente || excedido || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Aplicando…' : texto.verbo}
          </button>
        </>
      }
    >
      <Alert tone="warning">
        <strong>Qué va a pasar.</strong> {texto.consecuencia}
      </Alert>

      <label className="field" htmlFor="deployment-control-reason">
        <span className="field-label">Motivo</span>
        <textarea
          id="deployment-control-reason"
          className="field-input"
          rows={4}
          value={reason}
          maxLength={MAX_REASON_LENGTH}
          placeholder={texto.ejemplo}
          onChange={(event) => setReason(event.target.value)}
        />
        <span className="field-help">
          Obligatorio y queda en el registro de auditoría con tu nombre y la hora. Escríbelo para
          quien lo lea dentro de seis meses sin recordar este día: qué se observó y desde cuándo.
        </span>
      </label>

      {recortado.length > 0 && !suficiente ? (
        <p className="field-error" role="status">
          Faltan {MIN_REASON_LENGTH - recortado.length} caracteres. Un motivo que no explica nada
          llena el expediente sin informarlo.
        </p>
      ) : null}

      {mutation.isError ? <Alert tone="error">{errorMessage(mutation.error)}</Alert> : null}
    </ModalDialog>
  );
}
