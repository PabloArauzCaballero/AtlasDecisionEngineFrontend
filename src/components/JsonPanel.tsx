'use client';

import { Braces, Check, Copy, Download, GitBranch, Table2 } from 'lucide-react';
import { useState } from 'react';
import { downloadJson, exportFilename } from '../utils/download';
import { GraphView, TableView } from './json-views';

interface JsonPanelProps {
  value: unknown;
  label?: string;
}

type Mode = 'json' | 'table' | 'graph';

/**
 * Shows any data in three complementary views so every kind of user understands
 * it: JSON (crudo), Tabla (campo → valor, aplanado) y Gráfico (una traza de
 * ejecución se dibuja como fases/camino; cualquier otra cosa, como árbol).
 */
export function JsonPanel({ value, label = 'Respuesta' }: JsonPanelProps) {
  const [mode, setMode] = useState<Mode>('table');
  const [copied, setCopied] = useState(false);

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
    <section className="json-panel" aria-label={label}>
      <div className="panel-title">
        <span>{label}</span>
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
