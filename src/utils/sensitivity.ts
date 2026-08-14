/**
 * Enmascarado de datos personales, en un solo sitio.
 *
 * La regla existía y era la correcta —«un valor sensible nunca se pinta en
 * claro, aunque el backend lo hubiera enviado»—, pero vivía dentro de
 * `node-state-tables.tsx` y por eso la aplicaba UNA tabla. El expediente del
 * caso, el detalle de ejecución y los paneles de JSON crudo pintaban el mismo
 * dato sin tocar, y el panel que menos podía permitírselo era justo el que se
 * titula «Datos del solicitante».
 *
 * La clasificación la declara el catálogo (`sensitivityClass` en el contrato de
 * cada variable) y viaja con la ejecución. Aquí sólo se consulta.
 */

import { asRows, display, type UnknownRecord } from './records';

/** Clases que no se pintan en claro. Las mismas que avisan en los casos de prueba. */
export const SENSITIVE_CLASSES = ['PII', 'SENSITIVE_PII', 'SECRET'] as const;

/** Lo que se ve en lugar del valor. */
export const SENSITIVE_MASK = '•••';

export function isSensitiveClass(sensitivityClass: unknown): boolean {
  return (SENSITIVE_CLASSES as readonly string[]).includes(String(sensitivityClass ?? ''));
}

/**
 * Un valor de tabla, listo para pintar.
 *
 * `INTERNAL` es una clase y no es sensible: se compara contra la lista cerrada y
 * no contra «tiene clase».
 */
export function maskValue(value: unknown, sensitivityClass: unknown): string {
  if (value === null || value === undefined) return '—';
  if (isSensitiveClass(sensitivityClass)) return SENSITIVE_MASK;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * Códigos de variable que la ejecución declara sensibles.
 *
 * Se lee de las variables resueltas que trae la propia ejecución, que es donde
 * el motor publica la clasificación. Devuelve un conjunto para que enmascarar un
 * payload no sea cuadrático.
 */
export function sensitiveCodesOf(rows: readonly UnknownRecord[]): Set<string> {
  const codes = new Set<string>();
  for (const row of rows) {
    const sensitive = row.sensitive === true || isSensitiveClass(row.sensitivityClass);
    if (!sensitive) continue;
    for (const key of ['variableCode', 'code', 'name'] as const) {
      const value = display(row, key);
      if (value && value !== '—') codes.add(value);
    }
  }
  return codes;
}

/**
 * Enmascara, en profundidad, toda propiedad cuyo NOMBRE sea un código sensible.
 *
 * Va por nombre de propiedad y no por forma del valor porque es lo único que se
 * puede saber con certeza: el payload de entrada es libre —a veces
 * `{ variables: { CODE: valor } }`, a veces los códigos en la raíz—, y adivinar
 * «esto parece un documento de identidad» produciría tanto falso negativo como
 * falso positivo. Un código que el catálogo no clasificó no se enmascara: la
 * corrección está en clasificarlo, no en heurísticas aquí.
 */
export function maskRecordDeep(value: unknown, sensitiveCodes: ReadonlySet<string>): unknown {
  if (!sensitiveCodes.size) return value;
  if (Array.isArray(value)) return value.map((item) => maskRecordDeep(item, sensitiveCodes));
  if (value === null || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      sensitiveCodes.has(key) ? SENSITIVE_MASK : maskRecordDeep(entry, sensitiveCodes),
    ]),
  );
}

/** Atajo para las vistas: los códigos sensibles de una ejecución ya leída. */
export function sensitiveCodesOfExecution(execution: UnknownRecord): Set<string> {
  return sensitiveCodesOf(asRows(execution.variables));
}
