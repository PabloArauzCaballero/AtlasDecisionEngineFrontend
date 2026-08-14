'use client';

import { Braces, Check, Copy, Download, GitBranch, Table2 } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { downloadJson, exportFilename } from '../utils/download';
import { maskRecordDeep } from '../utils/sensitivity';
import { GraphView, TableView } from './json-views';

interface JsonPanelProps {
  value: unknown;
  label?: string;
  /**
   * Códigos de variable que el catálogo clasificó como personales o secretos.
   *
   * Quien pinta un payload de decisión los pasa; el resto de usos —una respuesta
   * de configuración, un contrato— no tienen nada que ocultar y lo omiten. Sin
   * esto, este panel enseñaba el dato del solicitante en claro y además lo
   * ofrecía a un clic en el portapapeles y en un archivo.
   */
  sensitiveCodes?: ReadonlySet<string>;
  /**
   * Ancla estable para los recorridos guiados.
   *
   * El catálogo apuntaba a estos paneles por `[aria-label="Input Payload"]`, y
   * eso ató un recorrido al TEXTO de un rótulo: traducir el panel al español lo
   * rompía, y de hecho `[aria-label="Input Snapshot"]` ya llevaba tiempo sin
   * casar con nada porque ese rótulo había cambiado antes. `data-tutorial-id`
   * es lo que el resto del portal usa justamente para no repetirlo.
   */
  tutorialId?: string;
}

type Mode = 'json' | 'table' | 'graph';

const NO_SENSITIVE_CODES: ReadonlySet<string> = new Set<string>();

/**
 * Shows any data in three complementary views so every kind of user understands
 * it: JSON (crudo), Tabla (campo → valor, aplanado) y Gráfico (una traza de
 * ejecución se dibuja como fases/camino; cualquier otra cosa, como árbol).
 */
export function JsonPanel({
  value: raw,
  label = 'Respuesta',
  sensitiveCodes = NO_SENSITIVE_CODES,
  tutorialId,
}: JsonPanelProps) {
  const [mode, setMode] = useState<Mode>('table');
  const [copied, setCopied] = useState(false);
  const titleId = useId();
  /*
   * Se enmascara UNA vez, arriba, y de ahí salen las tres vistas, el
   * portapapeles y la descarga. Enmascarar por vista dejaría la copia o el
   * archivo en claro en cuanto alguien añadiera la cuarta.
   */
  const value = useMemo(() => maskRecordDeep(raw, sensitiveCodes), [raw, sensitiveCodes]);
  const masked = sensitiveCodes.size > 0;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(value, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard can be blocked (insecure context / permissions); fail quietly.
    }
  };

  return (
    <section className="json-panel" aria-labelledby={titleId} data-tutorial-id={tutorialId}>
      <div className="panel-title">
        {/* Encabezado real, como en `Panel`: nombra la sección y aparece en la
            navegación por encabezados. */}
        <h2 id={titleId}>{label}</h2>
        {masked ? (
          <small className="json-panel-masked" title="Clasificación declarada en el catálogo">
            Datos personales enmascarados
          </small>
        ) : null}
        <div className="json-panel-actions">
          <div className="json-view-tabs" role="tablist" aria-label="Vista de los datos">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'table'}
              className={mode === 'table' ? 'active' : ''}
              onClick={() => setMode('table')}
            >
              <Table2 size={13} /> Tabla
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'graph'}
              className={mode === 'graph' ? 'active' : ''}
              onClick={() => setMode('graph')}
            >
              <GitBranch size={13} /> Gráfico
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'json'}
              className={mode === 'json' ? 'active' : ''}
              onClick={() => setMode('json')}
            >
              <Braces size={13} /> JSON
            </button>
          </div>
          <button
            type="button"
            className={copied ? 'json-copy-btn copied' : 'json-copy-btn'}
            onClick={() => void copy()}
            title="Copiar como JSON"
            aria-label="Copiar como JSON"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? 'Copiado' : 'Copiar'}
          </button>
          <button
            type="button"
            className="json-copy-btn"
            onClick={() => downloadJson(exportFilename('datos', 'json'), value)}
            title="Descargar JSON"
            aria-label="Descargar JSON"
          >
            <Download size={13} /> JSON
          </button>
        </div>
      </div>
      {mode === 'json' ? (
        <pre>{JSON.stringify(value, null, 2)}</pre>
      ) : mode === 'table' ? (
        <TableView value={value} />
      ) : (
        <GraphView value={value} />
      )}
    </section>
  );
}
