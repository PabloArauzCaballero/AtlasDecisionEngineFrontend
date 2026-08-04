import type { ImportLanguage } from '../../components/code-import-language';

export interface ContractVariable {
  id: string;
  name?: string;
  type?: string;
  required?: boolean;
}

export interface ImportContract {
  contractVersion: string;
  inputs: ContractVariable[];
  outputs: ContractVariable[];
  primaryOutputId?: string;
  /** Salida que lleva el MOTIVO de la decisión: la que se coteja con el catálogo. */
  reasonOutputId?: string;
}

/**
 * Lee el bloque `@atlas-contract` del propio código, en el navegador.
 *
 * Es el mismo bloque que extrae el motor, con las mismas reglas (marca exacta en
 * una línea de comentario, cuerpo JSON en las líneas de comentario siguientes,
 * hasta la primera línea de código). Se repite aquí porque la respuesta del
 * análisis NO devuelve el contrato entero: `reasonOutputId` —cuál de las salidas
 * lleva el motivo— no viaja en ella, y sin saberlo no se puede comprobar contra
 * el catálogo de motivos cuáles de los valores que escribe el código son códigos
 * de salida gobernados.
 *
 * No es autoritativo: el motor vuelve a extraerlo y sus avisos mandan.
 */
export function parseContractHeader(
  language: ImportLanguage,
  source: string,
): ImportContract | null {
  const prefix = language === 'PYTHON' ? '#' : '//';
  const lines = source.split('\n');
  const markerIndex = lines.findIndex((line) => line.trim() === `${prefix} @atlas-contract`);
  if (markerIndex === -1) return null;

  const body: string[] = [];
  for (let index = markerIndex + 1; index < lines.length; index += 1) {
    const line = lines[index].trimStart();
    if (!line.startsWith(prefix)) break;
    body.push(line.slice(prefix.length));
  }
  if (!body.length) return null;

  try {
    const parsed: unknown = JSON.parse(body.join('\n'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const record = parsed as Record<string, unknown>;
    return {
      contractVersion: String(record.contractVersion ?? '1'),
      inputs: variablesOf(record.inputs),
      outputs: variablesOf(record.outputs),
      primaryOutputId: textOf(record.primaryOutputId),
      reasonOutputId: textOf(record.reasonOutputId),
    };
  } catch {
    // Un JSON roto ya lo reporta el motor con su línea; aquí basta con no opinar.
    return null;
  }
}

function variablesOf(raw: unknown): ContractVariable[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => ({
      id: String(item.id ?? ''),
      name: textOf(item.name),
      type: textOf(item.type),
      required: typeof item.required === 'boolean' ? item.required : undefined,
    }))
    .filter((variable) => variable.id !== '');
}

function textOf(raw: unknown): string | undefined {
  return typeof raw === 'string' && raw.trim() ? raw.trim() : undefined;
}
