'use client';

import { Check, ClipboardCopy } from 'lucide-react';
import { useState } from 'react';

interface Props {
  /** Texto exacto que se lleva el portapapeles, sin recortar. */
  text: string;
  /** Qué se copia, para el rótulo y el nombre accesible: «Copiar {label}». */
  label: string;
  className?: string;
}

/**
 * Copiar un texto al portapapeles, confirmando que se copió.
 *
 * El portapapeles exige contexto seguro y permiso del navegador: si lo niega, el
 * botón lo DICE en vez de quedarse mudo fingiendo éxito. La confirmación se
 * revierte a los dos segundos, porque un botón congelado en «copiado» deja de
 * informar de si la última pulsación funcionó.
 */
export function CopyButton({ text, label, className = 'button' }: Props) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
      setTimeout(() => setState('idle'), 2_000);
    } catch {
      setState('failed');
    }
  };

  return (
    <>
      <button type="button" className={className} onClick={() => void copy()}>
        {state === 'copied' ? (
          <Check size={14} aria-hidden="true" />
        ) : (
          <ClipboardCopy size={14} aria-hidden="true" />
        )}
        {state === 'copied' ? 'Copiado' : `Copiar ${label}`}
      </button>
      {state === 'failed' ? (
        <small className="field-hint">
          El navegador no dejó copiar (hace falta una conexión segura). Selecciona el texto y
          cópialo a mano.
        </small>
      ) : null}
    </>
  );
}
