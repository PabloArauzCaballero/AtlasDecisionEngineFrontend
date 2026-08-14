'use client';

import { useState } from 'react';
import Link from 'next/link';
import { EmptyState } from '../../components/EmptyState';
import { Panel } from '../../components/Panel';
import { useNotifications } from '../../notifications/useNotifications';
import { useManualOutcome, usePendingWindows, type PendingWindow } from './decision-quality.api';

/** Los cinco desenlaces que el motor reconoce, con el nombre que usa quien los carga. */
const LABELS = [
  { code: 'GOOD', label: 'Se comportó bien' },
  { code: 'BAD', label: 'Incumplió o se perdió' },
  { code: 'REJECTED_WOULD_HAVE_BEEN_GOOD', label: 'Rechazado que habría ido bien' },
  { code: 'REJECTED_CONFIRMED_BAD', label: 'Rechazado y se confirmó malo' },
  { code: 'INDETERMINATE', label: 'Todavía no se sabe' },
] as const;

/**
 * La cola de ventanas vencidas que nadie observó.
 *
 * Es el producto principal de todo el módulo: convierte «faltan desenlaces» —una afirmación con
 * la que no se puede hacer nada— en una lista con nombres, ordenada por antigüedad. Cerrar una
 * desde aquí existe para el caso puntual (un fraude confirmado, una corrección); el grueso lo
 * carga la conciliación por lote.
 *
 * `INDETERMINATE` es una opción de primera clase y no un descuido: registrar «no se sabe» cierra
 * la ventana y distingue el caso mirado del caso olvidado, que es justo la confusión que la cola
 * viene a eliminar.
 */
export function PendingWindowsPanel() {
  const pending = usePendingWindows(50);
  const [selected, setSelected] = useState<PendingWindow | null>(null);
  const items = pending.data?.items ?? [];

  return (
    <Panel
      title="Ventanas vencidas sin observar"
      meta={pending.isLoading ? 'Cargando…' : `${items.length} en cola`}
      tutorialId="quality-pending"
    >
      {!pending.isLoading && !items.length ? (
        <EmptyState
          illustration="success"
          title="Ninguna ventana vencida sin cerrar"
          description="Todas las observaciones que tocaban están registradas."
          example="Si esperabas ver casos aquí, comprueba que la conciliación con cartera se esté ejecutando: una tubería parada produce esta misma pantalla."
        />
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Crédito</th>
              <th scope="col">Algoritmo</th>
              <th scope="col">Ventana</th>
              <th scope="col">Vencida hace</th>
              <th scope="col">Registrar</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.windowId}>
                <td>
                  {item.externalReference ?? (
                    <span className="quality-muted">sin crédito asociado</span>
                  )}
                </td>
                <td>{item.artifactCode}</td>
                <td>{item.windowDays} días</td>
                <td className={item.overdueDays > 30 ? 'quality-overdue' : undefined}>
                  {item.overdueDays} días
                </td>
                <td>
                  <button type="button" className="button" onClick={() => setSelected(item)}>
                    Registrar desenlace
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selected && <ManualOutcomeForm window={selected} onClose={() => setSelected(null)} />}
    </Panel>
  );
}

function ManualOutcomeForm({
  window: item,
  onClose,
}: {
  window: PendingWindow;
  onClose: () => void;
}) {
  const [label, setLabel] = useState<string>('GOOD');
  const [notes, setNotes] = useState('');
  const record = useManualOutcome();
  const { notify } = useNotifications();

  const submit = async () => {
    await record.mutateAsync({
      executionId: item.executionId,
      windowDays: item.windowDays,
      label,
      source: 'PORTAL_MANUAL',
      notes: notes.trim() || undefined,
    });
    notify({
      tone: 'success',
      title: 'Desenlace registrado',
      description: `La ventana de ${item.windowDays} días queda cerrada y sale de la cola.`,
    });
    onClose();
  };

  return (
    <div className="quality-inline-form">
      <p>
        Decisión <Link href={`/executions/${item.executionId}`}>{item.executionId}</Link>, ventana
        de {item.windowDays} días.
      </p>
      <label className="field">
        <span>Qué pasó</span>
        <select value={label} onChange={(event) => setLabel(event.target.value)}>
          {LABELS.map((option) => (
            <option key={option.code} value={option.code}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Nota (opcional)</span>
        <input value={notes} onChange={(event) => setNotes(event.target.value)} />
      </label>
      <div className="quality-inline-actions">
        <button
          type="button"
          className="button primary"
          onClick={submit}
          disabled={record.isPending}
        >
          {record.isPending ? 'Registrando…' : 'Registrar'}
        </button>
        <button type="button" className="button" onClick={onClose}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
