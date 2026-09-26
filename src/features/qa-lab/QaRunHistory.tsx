'use client';

import { Eye, RotateCcw } from 'lucide-react';
import { EmptyState } from '../../components/EmptyState';
import { formatDateTime } from '../../config/locale';
import { display, type UnknownRecord } from '../../utils/records';
import { runStatusLabel } from './qa-run-status';

interface Props {
  history: UnknownRecord[];
  /** Abre el resultado de una corrida archivada, sin tocar el formulario. */
  onOpen: (runId: string) => void;
  /** Abre la corrida y devuelve al formulario su semilla y TODA su configuración. */
  onReproduce: (runId: string) => void;
}

const STOPPED_LABEL: Readonly<Record<string, string>> = {
  TIMEOUT: ' · cortada por tiempo',
  FIRST_FAILURE: ' · parada en el primer fallo',
};

const FAKER_LABEL: Readonly<Record<string, string>> = {
  mock: 'Fakers',
  'local-fallback': 'Generador local (sin fakers)',
  none: 'Del contrato',
};

/**
 * Historial de corridas.
 *
 * El estado se enseña como columna propia porque desde que la corrida es asíncrona una
 * fila puede estar todavía trabajando: sin esa columna, una corrida en marcha se leía como
 * una corrida terminada con cero casos, que es la lectura contraria a la verdadera.
 *
 * «Reproducir» restaura la configuración archivada completa, no sólo la semilla: la semilla
 * sola con otro número de casos u otra mezcla genera otro lote.
 */
export function QaRunHistory({ history, onOpen, onReproduce }: Props) {
  if (!history.length) {
    return (
      <EmptyState
        illustration="tests"
        title="Sin corridas todavía"
        description="Elige una versión compilada y lanza una corrida: el generador leerá su contrato y creará casos válidos, en el límite e inválidos por sí solo."
        example="200 casos con 60 % válidos, 15 % en el límite y 25 % inválidos"
      />
    );
  }

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th scope="col">Inicio</th>
          <th scope="col">Estado</th>
          <th scope="col">Semilla</th>
          <th scope="col">Casos</th>
          <th scope="col">Con fallo</th>
          <th scope="col">Datos</th>
          <th scope="col">Acciones</th>
        </tr>
      </thead>
      <tbody>
        {history.map((entry) => {
          const id = display(entry, 'id');
          const planned = Number(entry.plannedCases ?? 0);
          const executed = display(entry, 'totalCases');
          return (
            <tr key={id}>
              <td>{formatDateTime(display(entry, 'startedAt'))}</td>
              <td>
                {runStatusLabel(display(entry, 'status'))}
                {STOPPED_LABEL[String(entry.stoppedReason ?? '')] ?? ''}
              </td>
              <td>
                <code>{display(entry, 'seed')}</code>
              </td>
              <td>{planned > 0 ? `${executed} de ${planned}` : executed}</td>
              <td>{display(entry, 'failedCases')}</td>
              <td>{FAKER_LABEL[String(entry.fakerSource ?? '')] ?? '—'}</td>
              <td>
                <div className="panel-actions">
                  <button type="button" className="button" onClick={() => onOpen(id)}>
                    <Eye size={14} aria-hidden /> Ver resultado
                  </button>
                  <button type="button" className="button" onClick={() => onReproduce(id)}>
                    <RotateCcw size={14} aria-hidden /> Reproducir
                  </button>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
