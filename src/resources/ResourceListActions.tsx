'use client';

import { Download, Plus } from 'lucide-react';
import type { ResourceConfig } from './resource.types';

interface ResourceListActionsProps {
  config: ResourceConfig;
  /** Hay filas que exportar: sin ellas el botón no promete nada. */
  hasRows: boolean;
  /** El rol del usuario alcanza el alta declarada en `createRoles`. */
  canCreate: boolean;
  disabled: boolean;
  /** Abre el alta; ausente cuando esta vista todavía no la ofrece. */
  onCreate?: () => void;
  createTitle?: string;
  onExport: () => void;
}

/**
 * Acciones de la cabecera de un listado: exportar y dar de alta.
 *
 * El botón de alta nunca desaparece cuando el rol no llega: se apaga y dice cuál
 * es el permiso que falta. Una acción que se esfuma deja al usuario buscando algo
 * que cree recordar; una apagada con motivo le dice a quién pedírselo.
 */
export function ResourceListActions({
  config,
  hasRows,
  canCreate,
  disabled,
  onCreate,
  createTitle,
  onExport,
}: ResourceListActionsProps) {
  const denied = !canCreate;
  const title = denied
    ? (config.createDeniedHint ?? 'Tu rol no puede dar de alta en esta vista')
    : (createTitle ?? (onCreate ? undefined : 'Esta alta aún no está disponible en esta vista'));

  return (
    <>
      <button className="button" type="button" disabled={!hasRows} onClick={onExport}>
        <Download size={16} /> Exportar
      </button>
      {config.primaryAction ? (
        <button
          className="button button-primary"
          type="button"
          data-tutorial-id="resource-create"
          disabled={disabled || denied || !onCreate}
          title={title}
          onClick={onCreate}
        >
          <Plus size={16} /> {config.primaryAction}
        </button>
      ) : null}
    </>
  );
}
