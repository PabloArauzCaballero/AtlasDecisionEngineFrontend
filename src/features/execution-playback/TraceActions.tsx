'use client';

import { Check, ClipboardCopy, Download } from 'lucide-react';
import { useState } from 'react';
import { downloadJson, exportFilename } from '../../utils/download';

interface TraceActionsProps {
  /** La traza tal como la devolvió el motor: se entrega sin recortar. */
  trace: unknown;
  /** Prefijo del archivo: identifica de qué ejecución salió. */
  name: string;
}

/**
 * Llevarse la traza: al portapapeles o a un archivo.
 *
 * Una traza se mira aquí, pero se ANALIZA en otro sitio —se pega en un ticket,
 * se compara con la de ayer, se le pasa un `jq`—. Sin esto, la única salida era
 * seleccionar a mano un panel con tablas y perder la estructura por el camino.
 *
 * Se entrega el objeto completo del motor, no lo que la pantalla pinta: lo que
 * se adjunta a una incidencia tiene que poder reproducir el análisis entero, y
 * un recorte deja fuera justo el campo que hacía falta.
 */
export function TraceActions({ trace, name }: TraceActionsProps) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(trace, null, 2));
      setCopied(true);
      setFailed(false);
      // Vuelve a su estado tras confirmar: un botón que se queda en «copiado»
      // para siempre deja de decir si la ÚLTIMA pulsación funcionó.
      setTimeout(() => setCopied(false), 2_000);
    } catch {
      // El portapapeles exige contexto seguro y permiso: si el navegador lo
      // niega, se dice, en vez de fingir que se copió.
      setFailed(true);
    }
  };

  return (
    <div className="trace-actions">
      <button type="button" className="button" onClick={() => void copy()}>
        {copied ? (
          <Check size={15} aria-hidden="true" />
        ) : (
          <ClipboardCopy size={15} aria-hidden="true" />
        )}
        {copied ? 'Traza copiada' : 'Copiar traza'}
      </button>
      <button
        type="button"
        className="button"
        onClick={() => downloadJson(exportFilename(`traza-${name}`, 'json'), trace)}
      >
        <Download size={15} aria-hidden="true" /> Descargar traza
      </button>
      {failed ? (
        <small className="field-hint">
          El navegador no dejó copiar al portapapeles (hace falta una conexión segura). Usa
          «Descargar traza».
        </small>
      ) : null}
    </div>
  );
}
