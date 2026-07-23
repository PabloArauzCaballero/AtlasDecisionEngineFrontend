'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ACTIONS, type ActionDefinition, type ActionKey } from './action-catalog';
import { ModalDialog } from './ModalDialog';
import { Tooltip } from './Tooltip';

interface ActionIconProps {
  action: ActionKey;
  /** Handler para acciones tipo botón. Con `confirm`, corre tras confirmar. */
  onClick?: () => void;
  /** Enlace para acciones de navegación (Ver, Grafo…). */
  href?: string;
  disabled?: boolean;
  /** Texto accesible más específico que el del catálogo (recomendado). */
  label?: string;
  size?: number;
}

/**
 * Botón de acción de solo icono, alimentado por el catálogo central. Aporta,
 * de forma consistente y sin duplicar lógica: tooltip, `aria-label`, variante
 * visual, estado deshabilitado y confirmación cuando la acción lo exige.
 */
export function ActionIcon({ action, onClick, href, disabled, label, size = 16 }: ActionIconProps) {
  const def: ActionDefinition = ACTIONS[action];
  const Icon = def.icon;
  const text = label ?? def.label;
  const [confirming, setConfirming] = useState(false);
  const className = `action-icon action-icon-${def.variant}`;

  if (href && !def.confirm) {
    return (
      <Tooltip content={text}>
        <Link
          className={className}
          href={disabled ? '#' : href}
          aria-label={text}
          aria-disabled={disabled || undefined}
        >
          <Icon size={size} aria-hidden />
        </Link>
      </Tooltip>
    );
  }

  return (
    <>
      <Tooltip content={text}>
        <button
          type="button"
          className={className}
          aria-label={text}
          disabled={disabled}
          onClick={() => {
            if (def.confirm) setConfirming(true);
            else onClick?.();
          }}
        >
          <Icon size={size} aria-hidden />
        </button>
      </Tooltip>
      {def.confirm && confirming ? (
        <ModalDialog
          title={def.confirm.title}
          tone={def.variant === 'danger' ? 'danger' : 'default'}
          onClose={() => setConfirming(false)}
          actions={
            <>
              <button className="button" type="button" onClick={() => setConfirming(false)}>
                Cancelar
              </button>
              <button
                className="button button-primary"
                type="button"
                onClick={() => {
                  setConfirming(false);
                  onClick?.();
                }}
              >
                {def.confirm.confirmLabel}
              </button>
            </>
          }
        >
          <p>{def.confirm.body}</p>
        </ModalDialog>
      ) : null}
    </>
  );
}
