import { asRows, display, type UnknownRecord } from '../../utils/records';

/**
 * Gates (evidencia obligatoria) de una solicitud de aprobación.
 *
 * La versión anterior de la pantalla pintaba cuatro gates fijos —«Compilación
 * determinista», «Suite bloqueante aprobada»…— cada uno con la insignia PASSED
 * escrita a mano, sin mirar la respuesta del backend. Un revisor aprobaba un
 * despliegue creyendo que cuatro comprobaciones habían pasado cuando no se
 * había comprobado ninguna. Aquí se leen los resultados reales y, cuando no
 * llegan, se dice que no llegaron en vez de inventarlos.
 */

/** Claves donde el backend puede colgar los resultados, en orden de preferencia. */
const GATE_KEYS = ['gates', 'qualityGates', 'checks', 'validations', 'evidence'] as const;

export interface GateRow {
  key: string;
  label: string;
  /** Estado tal como lo mandó el backend; nunca se rellena por defecto. */
  status: string | null;
  detail: string | null;
}

export interface GateReport {
  rows: GateRow[];
  /** `false` cuando la respuesta no trae gates: no se puede afirmar nada. */
  reported: boolean;
  /** Gates que no están en un estado de aprobación. */
  failing: GateRow[];
}

const PASSING = new Set(['PASSED', 'PASS', 'OK', 'SUCCESS', 'SUCCEEDED', 'APPROVED', 'GREEN']);

function nullable(record: UnknownRecord, ...keys: string[]): string | null {
  const value = display(record, ...keys);
  return value === '—' ? null : value;
}

function toRow(entry: UnknownRecord, index: number): GateRow {
  const label = nullable(entry, 'name', 'label', 'gate', 'code', 'type');
  return {
    key: nullable(entry, 'id', 'code', 'name') ?? `gate-${index}`,
    label: label ?? `Gate ${index + 1}`,
    status: nullable(entry, 'status', 'result', 'outcome', 'state'),
    detail: nullable(entry, 'detail', 'message', 'description', 'summary'),
  };
}

/** ¿El estado cuenta como aprobado? Lo desconocido no se da por bueno. */
export function isPassingGate(status: string | null): boolean {
  return status !== null && PASSING.has(status.trim().toUpperCase());
}

/**
 * Extrae los gates de la solicitud o de su versión. Ninguna fuente disponible
 * se traduce en `reported: false`, no en una lista optimista.
 */
export function readGates(...sources: UnknownRecord[]): GateReport {
  for (const source of sources) {
    for (const key of GATE_KEYS) {
      const rows = asRows(source[key]);
      if (!rows.length) continue;
      const mapped = rows.map(toRow);
      return {
        rows: mapped,
        reported: true,
        failing: mapped.filter((r) => !isPassingGate(r.status)),
      };
    }
  }
  return { rows: [], reported: false, failing: [] };
}
