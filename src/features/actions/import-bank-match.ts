import { asRecord, asRows, display, type UnknownRecord } from '../../utils/records';
import type { BankEntry } from './action-bank';

export interface ImportAssignment {
  /** Paso generado que escribe el valor. */
  node: string;
  outputCode: string;
  /** El valor literal, o vacío cuando lo calcula una expresión. */
  value: string;
  /** Acción del banco que ya hace exactamente eso, si la hay. */
  match?: { code: string; implies: string; kind: 'motivo' | 'campo' };
}

/**
 * Cruza lo que un import de código va a escribir con el banco de acciones.
 *
 * El analizador del motor no genera acciones: convierte cada rama en un nodo
 * RESULT con asignaciones literales, así que un motivo de negocio acaba dentro
 * del grafo como el texto «AGE_NOT_ELIGIBLE» y no como el reason code que el
 * banco ya tiene declarado. Sobre el resultado no se puede filtrar, ni explicar
 * al cliente, ni auditar por motivo.
 *
 * Esto no lo arregla —eso es trabajo del motor, ver `docs/banco-de-acciones.md`—
 * pero lo hace visible antes de guardar: aquí está lo que vas a escribir a mano
 * y aquí la acción del banco que significa lo mismo.
 */
export function matchImportToBank(
  nodes: UnknownRecord[],
  entries: BankEntry[],
): ImportAssignment[] {
  const byReason = new Map<string, BankEntry>();
  const byField = new Map<string, BankEntry>();
  for (const entry of entries) {
    for (const reason of entry.reasons.split(',')) {
      const code = reason.trim();
      if (code) byReason.set(code, entry);
    }
    if (entry.writes && entry.writes !== '—') byField.set(entry.writes, entry);
  }

  return nodes
    .filter((node) => display(node, 'type') === 'RESULT')
    .flatMap((node) => {
      const label = display(node, 'label', 'key');
      return asRows(asRecord(node.config).assignments).map((assignment) => {
        const outputCode = display(assignment, 'outputCode');
        const value = assignment.value === undefined ? '' : String(assignment.value);
        const reasonMatch = byReason.get(value);
        const fieldMatch = byField.get(outputCode);
        return {
          node: label,
          outputCode,
          value,
          match: reasonMatch
            ? { code: reasonMatch.code, implies: reasonMatch.implies, kind: 'motivo' as const }
            : fieldMatch
              ? { code: fieldMatch.code, implies: fieldMatch.implies, kind: 'campo' as const }
              : undefined,
        };
      });
    });
}

/**
 * Lo que queda sin resolver y merece un aviso.
 *
 * Descarta lo que el import ya emite como acción, y acota el resto a la salida
 * que lleva el motivo. Sin ese segundo filtro el panel señalaba también
 * `decision = RECHAZADO` y `limite = 0` —valores normales del resultado, no
 * motivos de negocio— y acababa pidiendo declarar en el banco cosas que no
 * pintan nada allí, justo debajo de decir que ya estaba todo emitido.
 *
 * Cuál es la salida del motivo no hace falta declararlo: es aquella cuyos
 * valores el motor convirtió en acciones. Si no convirtió ninguna, no hay
 * ninguna pista y se avisa de todo, que es como se comportaba antes.
 */
export function pendingLiterals(
  assignments: ImportAssignment[],
  emittedReasonCodes: readonly string[],
): ImportAssignment[] {
  const emitted = new Set(emittedReasonCodes);
  const reasonOutputs = new Set(
    assignments.filter((entry) => emitted.has(entry.value)).map((entry) => entry.outputCode),
  );
  return assignments.filter(
    (entry) =>
      !emitted.has(entry.value) &&
      (reasonOutputs.size === 0 || reasonOutputs.has(entry.outputCode)),
  );
}

/** Sólo las asignaciones que el banco ya sabe hacer, sin repetir la misma acción. */
export function reusableFromImport(assignments: ImportAssignment[]): ImportAssignment[] {
  const seen = new Set<string>();
  return assignments.filter((assignment) => {
    if (!assignment.match || seen.has(assignment.match.code)) return false;
    seen.add(assignment.match.code);
    return true;
  });
}
