'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { GitBranchPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { errorMessage } from '../../api/ApiError';
import { apiRequest } from '../../api/http-client';
import { canProposeArtifactChange } from '../../auth/business-rules';
import { useEffectiveRoles } from '../../auth/useAuth';
import { Alert } from '../../components/Alert';
import { Field } from '../../components/Field';
import { ModalDialog } from '../../components/ModalDialog';
import { useNotifications } from '../../notifications/useNotifications';
import { display, type UnknownRecord } from '../../utils/records';
import { newVersionBlocker, suggestNextSemanticVersion, toClonePayload } from './new-version';

interface NewVersionButtonProps {
  /** La versión de la que parte la nueva: se clona entera a un borrador. */
  sourceVersionId: string;
  /** Su número, tal como se muestra (`2.1.0`); sirve para proponer el siguiente. */
  sourceVersion: string;
  /** Nombre del algoritmo, para el título del diálogo. */
  algorithmName?: string;
  variant?: 'primary' | 'default';
  /** Texto del botón; por defecto «Nueva versión». */
  label?: string;
}

/**
 * «Nueva versión»: la única forma de cambiar un algoritmo que ya tiene una versión compilada, aprobada o desplegada.
 *
 * Pide qué cambia (viaja a quienes la aprueban) y, opcionalmente, el número; clona la versión de origen a un
 * borrador y abre el editor sobre él. La autoría es de QA y Fraude: a los demás el botón les dice por qué no.
 */
export function NewVersionButton({
  sourceVersionId,
  sourceVersion,
  algorithmName,
  variant = 'default',
  label = 'Nueva versión',
}: NewVersionButtonProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { notify } = useNotifications();
  const canAuthor = canProposeArtifactChange(useEffectiveRoles());
  const [open, setOpen] = useState(false);
  const [changeSummary, setChangeSummary] = useState('');
  const [semanticVersion, setSemanticVersion] = useState('');
  const draft = { changeSummary, semanticVersion };
  const blocker = newVersionBlocker(draft);

  const create = useMutation({
    mutationFn: () =>
      apiRequest<UnknownRecord>(
        `/v1/artifact-versions/${encodeURIComponent(sourceVersionId)}/clone`,
        {
          method: 'POST',
          body: toClonePayload(draft),
        },
      ),
    onSuccess: async (created) => {
      const newId = display(created, 'id');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['artifact-detail'] }),
        queryClient.invalidateQueries({ queryKey: ['algorithm-versions'] }),
      ]);
      notify({
        tone: 'success',
        title: `Versión ${display(created, 'semanticVersion', 'versionNumber')} creada como borrador`,
        description:
          'Edítala, valídala y pásale sus pruebas; después va a revisión de dos personas y a despliegue.',
      });
      setOpen(false);
      if (newId !== '—') router.push(`/graph-editor?versionId=${encodeURIComponent(newId)}`);
    },
  });

  const abrir = () => {
    setChangeSummary('');
    setSemanticVersion(suggestNextSemanticVersion(sourceVersion));
    create.reset();
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        className={variant === 'primary' ? 'button button-primary' : 'button'}
        data-tutorial-id="algorithm-new-version"
        disabled={!canAuthor}
        title={
          canAuthor
            ? `Crear un borrador nuevo a partir de la v${sourceVersion}`
            : 'Crear versiones es tarea de QA o Fraude. Pide ese rol o pídeselo a quien lo tenga.'
        }
        onClick={abrir}
      >
        <GitBranchPlus size={16} /> {label}
      </button>
      {open ? (
        <ModalDialog
          title="Nueva versión"
          subtitle={`${algorithmName ? `${algorithmName} · ` : ''}parte de la v${sourceVersion}`}
          icon={<GitBranchPlus size={18} />}
          onClose={() => setOpen(false)}
          actions={
            <>
              <button type="button" className="button" onClick={() => setOpen(false)}>
                Cancelar
              </button>
              <button
                type="button"
                className="button button-primary"
                disabled={Boolean(blocker) || create.isPending}
                title={blocker ?? undefined}
                onClick={() => create.mutate()}
              >
                {create.isPending ? 'Creando…' : 'Crear borrador y abrir el editor'}
              </button>
            </>
          }
        >
          <p>
            La v{sourceVersion} no se toca: se copia entera a un <strong>borrador</strong> nuevo.
            Ahí cambias lo que haga falta y lo llevas otra vez a validar, probar, revisar (dos
            personas) y desplegar.
          </p>
          <Field
            label="¿Qué cambia en esta versión?"
            required
            tooltip="Lo que leerán quienes la aprueben y lo que queda en el historial. Ejemplo: «Rechaza a quien tiene una cuota vencida antes de puntuar»."
          >
            <textarea
              rows={3}
              value={changeSummary}
              onChange={(event) => setChangeSummary(event.target.value)}
            />
          </Field>
          <Field
            label="Número de versión"
            tooltip="Opcional, como 2.3.0. Sube el segundo número si cambia una regla y el primero si cambia qué decide. Vacío: lo numera el motor."
          >
            <input
              type="text"
              inputMode="decimal"
              placeholder="2.3.0"
              value={semanticVersion}
              onChange={(event) => setSemanticVersion(event.target.value)}
            />
          </Field>
          {blocker && changeSummary ? <Alert tone="info">{blocker}</Alert> : null}
          {create.isError ? <Alert tone="error">{errorMessage(create.error)}</Alert> : null}
        </ModalDialog>
      ) : null}
    </>
  );
}
