'use client';

import { Library, Link2 } from 'lucide-react';
import type { UnknownRecord } from '../../utils/records';
import { useActionBank } from './useActionBank';
import { matchImportToBank, pendingLiterals, reusableFromImport } from './import-bank-match';

interface Props {
  /** Nodos del grafo que el analizador acaba de generar. */
  nodes: UnknownRecord[];
  /** Motivos que el import YA emite como acción `EMIT_REASON` del catálogo. */
  emittedReasonCodes?: string[];
}

/**
 * Qué del código importado ya existe en el banco de acciones.
 *
 * El analizador escribe los resultados como literales dentro de cada rama, así
 * que un motivo de negocio entra al grafo como texto suelto aunque la
 * organización ya lo tenga declarado como acción. Enseñarlo antes de guardar
 * evita que cada import reinvente el vocabulario de decisiones.
 */
export function ImportBankPanel({ nodes, emittedReasonCodes = [] }: Props) {
  const bank = useActionBank();
  if (bank.isLoading || bank.isError || !bank.entries.length) return null;

  const emitted = new Set(emittedReasonCodes);
  const assignments = matchImportToBank(nodes, bank.entries);
  // Un motivo que el import ya emite como acción no es "texto suelto": no hay
  // nada que reutilizar a mano, así que se cuenta aparte en vez de repetirlo.
  const pending = pendingLiterals(assignments, emittedReasonCodes);
  const reusable = reusableFromImport(pending);
  const literals = pending.filter((assignment) => assignment.value !== '');
  if (!literals.length && !emitted.size) return null;

  return (
    <div className="import-bank">
      <h4>
        <Library size={14} aria-hidden="true" /> Banco de acciones
      </h4>
      {emitted.size ? (
        <p className="muted-text">
          Este import ya emite {emitted.size} {emitted.size === 1 ? 'motivo' : 'motivos'} del
          catálogo como acción (<b>{[...emitted].join(', ')}</b>): la decisión se podrá filtrar y
          explicar por ese motivo, no sólo leerlo como texto.
        </p>
      ) : null}
      {reusable.length ? (
        <>
          <p className="muted-text">
            El código escribe estos valores como texto literal. El banco ya tiene una acción que
            significa lo mismo: si la usas, el resultado queda explicado y auditable por motivo en
            lugar de ser una cadena suelta.
          </p>
          <ul className="import-bank-list">
            {reusable.map((assignment) => (
              <li key={assignment.match?.code}>
                <code>
                  {assignment.outputCode} = {assignment.value}
                </code>
                <Link2 size={13} aria-hidden="true" />
                <b>{assignment.match?.code}</b>
                <small>{assignment.match?.implies}</small>
              </li>
            ))}
          </ul>
        </>
      ) : literals.length ? (
        // Sólo cuando queda algo suelto SIN pareja. Sin esta condición el panel
        // se contradecía: decía «ya emite 4 motivos del catálogo» y justo debajo
        // «ninguno coincide, decláralo primero», mandando declarar lo que el
        // motor acababa de emitir.
        <p className="muted-text">
          Ninguno de los valores que escribe este código coincide con una acción del banco. Si
          alguno es un motivo de negocio, decláralo primero en el banco para poder explicarlo y
          auditarlo.
        </p>
      ) : null}
      {literals.length ? (
        <p className="muted-text">
          Al guardar, estas asignaciones se escriben dentro de cada rama tal cual. Sólo los valores
          que coinciden con un reason code del catálogo se convierten en una acción que los emite.
        </p>
      ) : null}
    </div>
  );
}
