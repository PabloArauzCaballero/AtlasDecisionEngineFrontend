'use client';

import { Download } from 'lucide-react';
import { useState } from 'react';
import { ModalDialog } from '../components/ModalDialog';
import { useNotifications } from '../notifications/useNotifications';
import { downloadCsv, exportFilename, toCsv } from '../utils/download';
import { exportResource } from './resource.api';
import type { ResourceConfig, ResourceRow } from './resource.types';

interface ExportDialogProps {
  config: ResourceConfig;
  /** Rows already loaded for the current page (the "current page" scope). */
  pageRows: readonly ResourceRow[];
  /** Active free-text search value and its backend param. */
  filter: string;
  /** Active extra filters keyed by backend param. */
  extraFilters: Record<string, string>;
  onClose: () => void;
}

type Scope = 'page' | 'all';

/** Human-readable summary of the filters that scope this export. */
function activeFilterChips(props: ExportDialogProps): string[] {
  const { config, filter, extraFilters } = props;
  const chips: string[] = [];
  if (filter.trim()) chips.push(`${config.filterLabel ?? 'Búsqueda'}: ${filter.trim()}`);
  for (const [param, value] of Object.entries(extraFilters)) {
    if (!value.trim()) continue;
    const label = config.filters?.find((entry) => entry.param === param)?.label ?? param;
    chips.push(`${label}: ${value.trim()}`);
  }
  return chips;
}

export function ExportDialog(props: ExportDialogProps) {
  const { config, pageRows, filter, extraFilters, onClose } = props;
  const { notify } = useNotifications();
  const [scope, setScope] = useState<Scope>('page');
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(config.columns.map((column) => column.key)),
  );
  const [busy, setBusy] = useState(false);

  const chips = activeFilterChips(props);
  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const columns = config.columns.filter((column) => selected.has(column.key));

  const runExport = async () => {
    if (!columns.length) return;
    setBusy(true);
    try {
      let rows: readonly ResourceRow[] = pageRows;
      let truncated = false;
      if (scope === 'all') {
        const result = await exportResource(config, { filter, filters: extraFilters });
        rows = result.rows;
        truncated = result.truncated;
      }
      downloadCsv(exportFilename(config.key, 'csv'), toCsv(rows, columns));
      notify({
        tone: truncated ? 'warning' : 'success',
        title: 'Exportación generada',
        description: truncated
          ? `Se exportaron los primeros ${rows.length} registros (límite alcanzado); afina los filtros para acotar.`
          : `${rows.length} registros de ${config.title} descargados como CSV.`,
      });
      onClose();
    } catch {
      notify({
        tone: 'error',
        title: 'No se pudo exportar',
        description: 'Revisa tu conexión y los filtros e inténtalo de nuevo.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalDialog
      title={`Exportar ${config.title}`}
      subtitle="Elige el alcance y las columnas antes de descargar el CSV."
      icon={<Download />}
      onClose={onClose}
      actions={
        <>
          <button className="button" type="button" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button
            className="button button-primary"
            type="button"
            onClick={() => void runExport()}
            disabled={busy || !columns.length}
          >
            {busy ? <span className="inline-spinner" aria-hidden="true" /> : <Download size={16} />}
            Exportar CSV
          </button>
        </>
      }
    >
      <div className="export-section">
        <span className="export-label">Alcance</span>
        <label className="export-scope">
          <input
            type="radio"
            name="export-scope"
            checked={scope === 'page'}
            onChange={() => setScope('page')}
          />
          <span>
            Página actual <strong>({pageRows.length})</strong>
          </span>
        </label>
        <label className="export-scope">
          <input
            type="radio"
            name="export-scope"
            checked={scope === 'all'}
            onChange={() => setScope('all')}
          />
          <span>Todos los resultados que cumplen los filtros</span>
        </label>
      </div>

      <div className="export-section">
        <span className="export-label">Filtros aplicados</span>
        {chips.length ? (
          <div className="export-chips">
            {chips.map((chip) => (
              <span key={chip} className="export-chip">
                {chip}
              </span>
            ))}
          </div>
        ) : (
          <p className="export-hint">Sin filtros: se exportará el conjunto completo.</p>
        )}
      </div>

      <div className="export-section">
        <span className="export-label">
          Columnas{' '}
          <small>
            ({columns.length} de {config.columns.length})
          </small>
        </span>
        <div className="export-columns">
          {config.columns.map((column) => (
            <label key={column.key} className="export-column">
              <input
                type="checkbox"
                checked={selected.has(column.key)}
                onChange={() => toggle(column.key)}
              />
              <span>{column.label}</span>
            </label>
          ))}
        </div>
        {!columns.length ? (
          <p className="export-hint export-hint-warn">Selecciona al menos una columna.</p>
        ) : null}
      </div>
    </ModalDialog>
  );
}
