'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Rocket, X } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { errorMessage } from '../../api/ApiError';
import { apiRequest } from '../../api/http-client';
import { promotionDenialReason } from '../../auth/business-rules';
import { Alert } from '../../components/Alert';
import { PickerSelect } from '../../components/PickerSelect';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { useNotifications } from '../../notifications/useNotifications';
import { display, type UnknownRecord } from '../../utils/records';
import { TrafficRulesEditor, trafficRulesValid, type TrafficRuleDraft } from './TrafficRulesEditor';
import { usePromotionTargets } from './usePromotionTargets';

type DeploymentCreateFormProps = { onClose: () => void };

const MODES = ['DIRECT', 'CANARY', 'CHAMPION_CHALLENGER'] as const;

/**
 * Promueve una versión aprobada a un ambiente vía
 * POST /v1/artifact-versions/{versionId}/deployments. DIRECT no manda reglas de
 * tráfico (el backend sólo valida los repartos cuando vienen); CANARY y
 * CHAMPION_CHALLENGER abren el editor de reparto.
 *
 * Quién puede promover depende del AMBIENTE, no del formulario: a un ambiente de
 * trabajo promueve quien propone el cambio; a producción, sólo un administrador
 * (`business-rules.ts`). Por eso el selector sólo lista los destinos permitidos y
 * la comprobación se repite antes de enviar: el catálogo puede degradar a texto
 * libre, y ahí el usuario podría escribir `PROD` a mano.
 */
export function DeploymentCreateForm({ onClose }: DeploymentCreateFormProps) {
  const queryClient = useQueryClient();
  const { notify } = useNotifications();
  const dialog = useRef<HTMLElement>(null);
  // Escape cierra, como en cualquier modal del portal. Sin esto el diálogo
  // atrapaba el foco y no daba salida por teclado: quien no usa el ratón se
  // quedaba dentro del formulario sin poder abandonarlo.
  useDialogFocus(dialog, undefined, onClose);
  const [versionId, setVersionId] = useState('');
  const [environmentCode, setEnvironmentCode] = useState('');
  const [deploymentMode, setDeploymentMode] = useState<string>('DIRECT');
  const [traffic, setTraffic] = useState<TrafficRuleDraft[]>([]);
  const targets = usePromotionTargets();
  const chosen = targets.allowed.find((environment) => environment.code === environmentCode);
  const denial = environmentCode
    ? promotionDenialReason(targets.roles, chosen ?? { code: environmentCode })
    : null;

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
    // Segunda comprobación, no decorativa: el ambiente puede haber llegado por
    // texto libre si el catálogo degradó, y ahí `allowed` no lo filtró.
    if (denial) return;
    create.mutate();
  };

  const ready =
    Boolean(versionId) &&
    Boolean(environmentCode) &&
    denial === null &&
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
            <label className="field">
              <span>Ambiente</span>
              <select
                required
                value={environmentCode}
                disabled={targets.isPending}
                onChange={(event) => setEnvironmentCode(event.target.value)}
              >
                <option value="">
                  {targets.isPending ? 'Cargando ambientes…' : 'Elegir ambiente…'}
                </option>
                {targets.allowed.map((environment) => (
                  <option key={environment.code} value={environment.code}>
                    {environment.name} ({environment.code})
                    {environment.isProduction ? ' · producción' : ''}
                  </option>
                ))}
              </select>
            </label>
            {targets.isError ? (
              <Alert tone="warning">
                No fue posible consultar los ambientes, así que no se puede saber cuál es
                productivo. Vuelve a intentarlo antes de promover.
              </Alert>
            ) : null}
            {targets.withheldProduction.length ? (
              <Alert tone="info">
                Puedes promover a ambientes de trabajo. Publicar en producción (
                {targets.withheldProduction.map((environment) => environment.code).join(', ')})
                requiere rol Platform Admin: envía la versión a revisión para que la firme.
              </Alert>
            ) : null}
            {denial ? <Alert tone="error">{denial}</Alert> : null}
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
