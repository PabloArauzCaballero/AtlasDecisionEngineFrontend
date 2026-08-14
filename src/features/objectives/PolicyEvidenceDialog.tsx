'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link2, TestTube2 } from 'lucide-react';
import { useState } from 'react';
import { apiRequest } from '../../api/http-client';
import { Alert } from '../../components/Alert';
import { ArtifactVersionPicker } from '../../components/ArtifactVersionPicker';
import { ModalDialog } from '../../components/ModalDialog';
import { PickerSelect } from '../../components/PickerSelect';
import { useNotifications } from '../../notifications/useNotifications';
import { display, type UnknownRecord } from '../../utils/records';

interface Props {
  policyId: string;
  policyCode: string;
  canLinkArtifact: boolean;
  canLinkTest: boolean;
  onClose: () => void;
}

/**
 * Enlaza evidencia a UN requisito de política.
 *
 * La acción vive en la política, no en el objetivo, porque así la modela el
 * motor: la evidencia cuelga de `policy_requirement`. La cabecera del detalle
 * ofrecía «Vincular Prueba» y «Vincular Versión» apagados, explicando que el
 * motor no lo exponía; sí lo expone desde hace tiempo —`POST
 * /v1/traceability/policies/:policyId/artifacts` y `…/test-suites`—, sólo que
 * pide una política y desde la cabecera no había ninguna elegida. Mientras
 * estuvieron apagados no había forma de registrar evidencia por el portal, así
 * que la matriz de cobertura sólo podía marcar 0 %.
 */
export function PolicyEvidenceDialog({
  policyId,
  policyCode,
  canLinkArtifact,
  canLinkTest,
  onClose,
}: Props) {
  const queryClient = useQueryClient();
  const { notify } = useNotifications();
  const [versionId, setVersionId] = useState('');
  const [suiteId, setSuiteId] = useState('');

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['objective-detail'] });
    await queryClient.invalidateQueries({ queryKey: ['coverage-matrix'] });
    await queryClient.invalidateQueries({ queryKey: ['resource', 'objectives'] });
  };

  const link = useMutation({
    mutationFn: (target: 'artifacts' | 'test-suites') =>
      apiRequest<UnknownRecord>(
        `/v1/traceability/policies/${encodeURIComponent(policyId)}/${target}`,
        {
          method: 'POST',
          body:
            target === 'artifacts' ? { artifactVersionId: versionId } : { testSuiteId: suiteId },
        },
      ),
    onSuccess: async (_data, target) => {
      await refresh();
      notify({
        tone: 'success',
        title: 'Evidencia enlazada',
        description:
          target === 'artifacts'
            ? `La versión quedó vinculada a ${policyCode}.`
            : `La suite quedó vinculada a ${policyCode}.`,
      });
      if (target === 'artifacts') setVersionId('');
      else setSuiteId('');
    },
  });

  return (
    <ModalDialog
      title="Vincular evidencia"
      subtitle={`Requisito ${policyCode}`}
      icon={<Link2 size={20} />}
      onClose={onClose}
      actions={
        <button className="button" type="button" onClick={onClose}>
          Cerrar
        </button>
      }
    >
      <p className="policy-evidence-intro">
        Un requisito cuenta como <b>completo</b> cuando tiene a la vez una versión de artefacto que
        lo implementa y una suite que lo demuestra. Con sólo una de las dos queda <b>parcial</b>.
      </p>
      <section className="policy-evidence-step">
        <h3>Artefacto que lo implementa</h3>
        {canLinkArtifact ? (
          <>
            <ArtifactVersionPicker versionId={versionId} onVersionChange={setVersionId} />
            <button
              className="button button-primary"
              type="button"
              disabled={!versionId || link.isPending}
              onClick={() => link.mutate('artifacts')}
            >
              <Link2 size={16} /> Vincular versión
            </button>
          </>
        ) : (
          <Alert tone="info">Vincular un artefacto requiere el rol Compliance o Riesgo.</Alert>
        )}
      </section>
      <section className="policy-evidence-step">
        <h3>Suite que lo demuestra</h3>
        {canLinkTest ? (
          <>
            <PickerSelect
              label="Suite de pruebas"
              value={suiteId}
              onChange={setSuiteId}
              endpoint="/v1/views/pickers/test-suites"
              queryKey="policy-evidence-suites"
              placeholder="Elegir suite…"
              mapOption={(row) => ({
                value: display(row, 'id'),
                label: `${display(row, 'suiteCode')} · ${display(row, 'artifactCode')}`,
              })}
            />
            <button
              className="button button-primary"
              type="button"
              disabled={!suiteId || link.isPending}
              onClick={() => link.mutate('test-suites')}
            >
              <TestTube2 size={16} /> Vincular suite
            </button>
          </>
        ) : (
          <Alert tone="info">Vincular una suite requiere el rol Compliance, Riesgo o QA.</Alert>
        )}
      </section>
    </ModalDialog>
  );
}
