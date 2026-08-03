'use client';

import { JsonPanel } from '../../components/JsonPanel';
import { asRows, display, type UnknownRecord } from '../../utils/records';

interface Props {
  /** Variables declaradas como salida del artefacto. */
  outputs: UnknownRecord[];
  /** Filas del contrato de salida, que dicen de dónde sale cada campo. */
  fields: UnknownRecord[];
}

/**
 * Forma del JSON que devolverá el artefacto publicado.
 *
 * Es una vista previa del CONTRATO, no de una ejecución: describe por cada campo
 * su tipo, su clasificación y los motivos estructurados que puede acompañarlo.
 * Sirve para que quien consume la decisión sepa qué esperar antes de publicarla.
 */
export function OutputContractJsonPreview({ outputs, fields }: Props) {
  return <JsonPanel value={buildPreviewShape(outputs, fields)} label="Vista previa JSON" />;
}

export function buildPreviewShape(
  outputs: UnknownRecord[],
  fields: UnknownRecord[],
): Record<string, unknown> {
  const byCode = new Map(asRows(fields).map((field) => [display(field, 'code'), field]));
  const shape: Record<string, unknown> = {};

  for (const output of asRows(outputs)) {
    const code = display(output, 'code');
    const field = byCode.get(code) ?? {};
    const reasonCodes = (Array.isArray(field.reasonCodes) ? field.reasonCodes : []).map(String);
    shape[code] = {
      tipo: display(output, 'dataType'),
      obligatorio: Boolean(output.required),
      // `display` devuelve «—» cuando falta, así que la ausencia se comprueba
      // sobre el valor crudo: si no, el defecto del panel nunca se aplicaría.
      sensibilidad: String(field.sensitivityClass ?? '') || 'INTERNAL',
      ...(reasonCodes.length ? { reasonCodes } : {}),
    };
  }

  return shape;
}
