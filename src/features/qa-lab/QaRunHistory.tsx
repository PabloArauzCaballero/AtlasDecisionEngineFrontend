'use client';

import { EmptyState } from '../../components/EmptyState';
import { formatDateTime } from '../../config/locale';
import { display, type UnknownRecord } from '../../utils/records';
import { runStatusLabel } from './qa-run-status';

interface Props {
  history: UnknownRecord[];
  /** Abre una corrida archivada y deja su semilla puesta para repetirla. */
  onOpen: (runId: string, seed: string) => void;
}

/**
 * Historial de corridas.
 *
 * El estado se enseña como columna propia porque desde que la corrida es asíncrona una
 * fila puede estar todavía trabajando: sin esa columna, una corrida en marcha se leía como
 * una corrida terminada con cero casos, que es la lectura contraria a la verdadera.
 */
export function QaRunHistory({ history, onOpen }: Props) {
  if (!history.length) {
    return (
      <EmptyState
        illustration="tests"
        title="Sin corridas todavía"
        description="Elige un algoritmo compilado y lanza una corrida: el generador leerá su contrato y creará casos válidos, de frontera e inválidos por sí solo."
        example="200 casos con 60 % válidos, 15 % de frontera y 25 % inválidos"
      />
    );
  }

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th scope="col">Inicio</th>
          <th scope="col">Estado</th>
          <th scope="col">Ambiente</th>
          <th scope="col">Semilla</th>
          <th scope="col">Casos</th>
          <th scope="col">Fallos</th>
          <th scope="col">Contraejemplos</th>
          <th scope="col" />
        </tr>
      </thead>
      <tbody>
        {history.map((entry) => (
          <tr key={display(entry, 'id')}>
            <td>{formatDateTime(display(entry, 'startedAt'))}</td>
            <td>{runStatusLabel(display(entry, 'status'))}</td>
            <td>{display(entry, 'environmentCode')}</td>
            <td>
              <code>{display(entry, 'seed')}</code>
            </td>
            <td>{display(entry, 'totalCases')}</td>
            <td>{display(entry, 'failedCases')}</td>
            <td>{display(entry, 'counterexamples')}</td>
            <td>
              <button
                type="button"
                className="button"
                onClick={() => onOpen(display(entry, 'id'), display(entry, 'seed'))}
              >
                Ver / reproducir
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
