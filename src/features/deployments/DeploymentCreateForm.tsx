'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Rocket, X } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { errorMessage } from '../../api/ApiError';
import { apiRequest } from '../../api/http-client';
import { Alert } from '../../components/Alert';
import { PickerSelect } from '../../components/PickerSelect';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { useNotifications } from '../../notifications/useNotifications';
import { display, type UnknownRecord } from '../../utils/records';
import { TrafficRulesEditor, trafficRulesValid, type TrafficRuleDraft } from './TrafficRulesEditor';

type DeploymentCreateFormProps = { onClose: () => void };

const MODES = ['DIRECT', 'CANARY', 'CHAMPION_CHALLENGER'] as const;

/**
 * Promotes an approved artifact version to an environment via
 * POST /v1/artifact-versions/{versionId}/deployments. DIRECT sends no traffic
 * rules (the backend only validates split totals when traffic is non-empty);
 * CANARY / CHAMPION_CHALLENGER expose the traffic split editor. Requires
 * PLATFORM_ADMIN (gated by the page).
 */
export function DeploymentCreateForm({ onClose }: DeploymentCreateFormProps) {
  const queryClient = useQueryClient();
  const { notify } = useNotifications();
  const dialog = useRef<HTMLElement>(null);
  useDialogFocus(dialog);
  const [versionId, setVersionId] = useState('');
  const [environmentCode, setEnvironmentCode] = useState('');
  const [deploymentMode, setDeploymentMode] = useState<string>('DIRECT');
  const [traffic, setTraffic] = useState<TrafficRuleDraft[]>([]);

  const create = useMutation({
    mutationFn: () =>
      apiRequest<UnknownRecord>(
        `/v1/artifact-versions/${encodeURIComponent(versionId)}/deployments`,
        {
          method: 'POST',
          body: {
            environmentCode,
            deploymentMode,
            traffic:
              deploymentMode === 'DIRECT'
                ? []
                : traffic.map((rule) => ({
                    segmentKey: rule.segmentKey.trim(),
                    trafficPercentage: Number(rule.trafficPercentage),
                    priority: Number(rule.priority),
                  })),
          },
        },
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['resource', 'deployments'] });
      notify({
        tone: 'success',
        title: 'Despliegue creado',
        description: `Versión promovida a ${environmentCode} (${deploymentMode}).`,
      });
      onClose();
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate();
  };

  const ready =
    Boolean(versionId) &&
    Boolean(environmentCode) &&
    (deploymentMode === 'DIRECT' || trafficRulesValid(traffic));

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !create.isPending) onClose();
      }}
    >
      <section
        ref={dialog}
        className="objective-create-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="deployment-create-title"
      >
        <header className="dialog-heading">
          <span className="dialog-heading-icon" aria-hidden="true">
            <Rocket size={20} />
          </span>
          <div>
            <p>Gobierno · Despliegues</p>
            <h2 id="deployment-create-title">Nuevo despliegue</h2>
            <span>Promueve una versión aprobada a un ambiente operativo.</span>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="Cerrar formulario"
            disabled={create.isPending}
            onClick={onClose}
          >
            <X />
          </button>
        </header>
        <form onSubmit={submit}>
          <div className="dialog-body">
            {create.isError ? <Alert tone="error">{errorMessage(create.error)}</Alert> : null}
            <PickerSelect
              label="Versión del artefacto (aprobada)"
              value={versionId}
              onChange={setVersionId}
              endpoint="/v1/views/pickers/artifact-versions"
              queryKey="deploy-artifact-versions"
              required
              placeholder="Elegir versión…"
              mapOption={(row) => {
                const id = display(row, 'id');
                return id === '—'
                  ? null
                  : {
                      value: id,
                      label: `${display(row, 'artifactCode')} v${display(row, 'semanticVersion')} · ${display(row, 'status')}`,
                    };
              }}
            />
            <PickerSelect
              label="Ambiente"
              value={environmentCode}
              onChange={setEnvironmentCode}
              endpoint="/v1/environments"
              queryKey="deploy-environments"
              required
              placeholder="Elegir ambiente…"
              mapOption={(row) => {
                const code = display(row, 'code', 'environmentCode');
                return code === '—'
                  ? null
                  : { value: code, label: `${display(row, 'name', 'code')} (${code})` };
              }}
            />
            <label className="field">
              <span>Modo de despliegue</span>
              <select
                value={deploymentMode}
                onChange={(event) => setDeploymentMode(event.target.value)}
              >
                {MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </label>
            {deploymentMode !== 'DIRECT' ? (
              <TrafficRulesEditor rules={traffic} onChange={setTraffic} />
            ) : null}
          </div>
          <footer className="dialog-actions">
            <button className="button" type="button" disabled={create.isPending} onClick={onClose}>
              Cancelar
            </button>
            <button
              className="button button-primary"
              type="submit"
              disabled={create.isPending || !ready}
            >
              <Rocket size={16} /> {create.isPending ? 'Desplegando…' : 'Desplegar'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
