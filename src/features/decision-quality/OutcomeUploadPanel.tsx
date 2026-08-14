'use client';

import { useState } from 'react';
import { Panel } from '../../components/Panel';
import { useNotifications } from '../../notifications/useNotifications';
import { useOutcomeBatch, type OutcomeDraft, type OutcomeRowResult } from './decision-quality.api';

const SAMPLE = `LOAN-2026-000841,90,BAD,COLLECTIONS_SYSTEM,320.50
LOAN-2026-000842,90,GOOD,COLLECTIONS_SYSTEM
LOAN-2026-000843,90,GOOD,COLLECTIONS_SYSTEM`;

/**
 * Carga de desenlaces en lote, con validación previa obligatoria.
 *
 * El botón que escribe está DESHABILITADO hasta que se ha validado. No es paternalismo: una
 * tanda de conciliación trae miles de filas, y descubrir en la 4000 que una referencia no existía
 * —con 3999 ya escritas sobre evidencia regulatoria— obliga a un borrado manual sobre la tabla
 * que justamente no se debe borrar a mano. Validar primero cuesta un segundo y evita eso.
 *
 * El formato es CSV pegado y no un selector de archivo porque quien hace esto todos los días
 * trabaja sobre una consulta que ya tiene en pantalla; obligarle a pasar por un archivo añade un
 * paso donde puede colarse la versión equivocada.
 */
export function OutcomeUploadPanel() {
  const [text, setText] = useState('');
  const [rows, setRows] = useState<OutcomeRowResult[] | null>(null);
  const [validated, setValidated] = useState(false);
  const batch = useOutcomeBatch();
  const { notify } = useNotifications();

  const parsed = parseCsv(text);
  const parseErrors = parsed.filter((entry) => 'error' in entry) as Array<{
    line: number;
    error: string;
  }>;
  const drafts = parsed.filter((entry): entry is OutcomeDraft => !('error' in entry));

  const run = async (dryRun: boolean) => {
    const result = await batch.mutateAsync({ outcomes: drafts, dryRun });
    setRows(result.rows);
    setValidated(dryRun && result.rejected === 0);
    if (!dryRun) {
      setValidated(false);
      notify({
        tone: 'success',
        title: `${result.accepted} desenlaces registrados`,
        description: result.rejected
          ? `${result.rejected} filas quedaron fuera; revisa el detalle.`
          : 'Las ventanas correspondientes quedan cerradas.',
      });
    }
  };

  return (
    <Panel
      title="Carga de desenlaces"
      meta="referencia de crédito, ventana, resultado, origen, importe"
      tutorialId="quality-upload"
    >
      <label className="field">
        <span>Filas en CSV</span>
        <textarea
          rows={8}
          value={text}
          placeholder={SAMPLE}
          onChange={(event) => {
            setText(event.target.value);
            setValidated(false);
            setRows(null);
          }}
        />
      </label>

      {parseErrors.length > 0 && (
        <ul className="quality-row-errors">
          {parseErrors.map((entry) => (
            <li key={entry.line}>
              Línea {entry.line}: {entry.error}
            </li>
          ))}
        </ul>
      )}

      <div className="quality-inline-actions">
        <button
          type="button"
          className="button"
          disabled={!drafts.length || parseErrors.length > 0 || batch.isPending}
          onClick={() => run(true)}
        >
          Validar {drafts.length ? `${drafts.length} filas` : ''}
        </button>
        <button
          type="button"
          className="button primary"
          disabled={!validated || batch.isPending}
          onClick={() => run(false)}
        >
          Registrar
        </button>
        {!validated && drafts.length > 0 && (
          <span className="quality-muted">
            Valida antes de escribir: nada se guarda hasta entonces.
          </span>
        )}
      </div>

      {rows && <RowResults rows={rows} />}
    </Panel>
  );
}

function RowResults({ rows }: { rows: OutcomeRowResult[] }) {
  const rejected = rows.filter((row) => !row.accepted);
  if (!rejected.length) {
    return <p className="quality-note">Las {rows.length} filas son válidas.</p>;
  }
  return (
    <div className="quality-row-errors">
      <p>
        {rejected.length} de {rows.length} filas se rechazarían:
      </p>
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Crédito</th>
            <th scope="col">Ventana</th>
            <th scope="col">Motivo</th>
          </tr>
        </thead>
        <tbody>
          {rejected.map((row) => (
            <tr key={`${row.externalReference}-${row.windowDays}`}>
              <td>{row.externalReference}</td>
              <td>{row.windowDays ?? '—'}</td>
              <td>
                <code>{row.code}</code> {row.message}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * CSV a filas, señalando la línea de cada problema.
 *
 * Un analizador que devuelve «formato inválido» a secas sobre dos mil líneas es inútil: quien lo
 * recibe no tiene forma de encontrar la fila mala salvo bisectando el archivo a mano.
 */
function parseCsv(text: string): Array<OutcomeDraft | { line: number; error: string }> {
  return text
    .split(/\r?\n/)
    .map((line, index) => ({ line: index + 1, raw: line.trim() }))
    .filter((entry) => entry.raw.length > 0)
    .map(({ line, raw }) => {
      const [externalReference, windowDays, label, source, amount] = raw
        .split(',')
        .map((cell) => cell.trim());
      if (!externalReference || !windowDays || !label || !source) {
        return { line, error: 'faltan columnas (crédito, ventana, resultado, origen).' };
      }
      const days = Number.parseInt(windowDays, 10);
      if (!Number.isInteger(days) || days <= 0) {
        return { line, error: `«${windowDays}» no es una ventana en días.` };
      }
      const parsedAmount = amount ? Number.parseFloat(amount) : undefined;
      if (amount && !Number.isFinite(parsedAmount)) {
        return { line, error: `«${amount}» no es un importe.` };
      }
      return { externalReference, windowDays: days, label, source, amount: parsedAmount };
    });
}
