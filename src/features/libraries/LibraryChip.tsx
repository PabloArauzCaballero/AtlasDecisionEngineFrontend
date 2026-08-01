'use client';

import { AlertTriangle, Ban, Lock, X } from 'lucide-react';
import { display, type UnknownRecord } from '../../utils/records';

interface Props {
  library: UnknownRecord;
  /** Si se pasa, el chip muestra el botón de quitar (versión modificable). */
  onRemove?: () => void;
}

const STATUS_ICON = {
  APPROVED: Lock,
  RESTRICTED: AlertTriangle,
  BLOCKED: Ban,
} as const;

const STATUS_TITLE = {
  APPROVED: 'Aprobada: puede usarse en los ambientes habilitados.',
  RESTRICTED: 'Restringida: revisión pendiente antes de habilitarla en producción.',
  BLOCKED: 'Bloqueada: no puede usarse en ninguna versión nueva.',
} as const;

/**
 * Ficha de una librería seleccionada (§7). Muestra nombre, versión exacta, categoría y
 * lenguaje: sin la versión, un chip no dice nada útil, porque la garantía de PROD es
 * precisamente que la versión está fijada y no se resuelve por rango.
 */
export function LibraryChip({ library, onRemove }: Props) {
  const status = (display(library, 'status') || 'APPROVED') as keyof typeof STATUS_ICON;
  const Icon = STATUS_ICON[status] ?? Lock;
  return (
    <span className={`library-chip library-${status.toLowerCase()}`} title={STATUS_TITLE[status]}>
      <Icon size={12} aria-hidden />
      <b>{display(library, 'logicalName')}</b>
      <code>@{display(library, 'version')}</code>
      <small>{display(library, 'category')}</small>
      <small className="library-chip-language">{display(library, 'language')}</small>
      {onRemove ? (
        <button
          type="button"
          aria-label={`Quitar la librería ${display(library, 'logicalName')}`}
          onClick={onRemove}
        >
          <X size={12} />
        </button>
      ) : null}
    </span>
  );
}
