'use client';

import { useQueries } from '@tanstack/react-query';
import { apiRequest } from '../../api/http-client';
import type { CodeImportIssue } from '../../components/CodeImportIssuesList';
import type { ImportLanguage } from '../../components/code-import-language';
import { parseConstraints } from '../../contracts/constraints';
import { asRecord, asRows, display, type UnknownRecord } from '../../utils/records';
import { parseContractHeader } from './contract-header';
import {
  allowedValueIssues,
  assignedLiterals,
  declaredVariables,
  locateIn,
  reasonIssues,
  variableIssues,
  type CatalogMatch,
} from './inventory-check';

interface Params {
  /** Sólo se consulta el inventario cuando hay un grafo generado que revisar. */
  enabled: boolean;
  language: ImportLanguage;
  source: string;
  dependencies: UnknownRecord[];
  nodes: UnknownRecord[];
}

export interface InventoryCheck {
  issues: CodeImportIssue[];
  declared: number;
  missing: number;
  isLoading: boolean;
  isError: boolean;
}

/** Página corta: se busca por código exacto, no se pagina un catálogo entero. */
const SEARCH = 'page=1&pageSize=25';

/**
 * Comprueba el contrato del código importado contra los catálogos gobernados.
 *
 * Un artefacto normal sólo puede usar variables y motivos que ya existen en el
 * inventario. La importación de código no: el motor, al guardar, CREA sola
 * cualquier variable que el contrato mencione y no encuentre (sin dueño, sin
 * clasificación y sin restricciones), y deja como cadena suelta cualquier motivo
 * que no esté declarado. Eso convierte esta pantalla en la puerta por la que el
 * catálogo se llena de variables que nadie gobierna.
 *
 * Aquí se exige lo mismo que en el resto del portal: cada entrada y cada salida
 * del contrato tienen que existir ya en el catálogo, con su tipo, y cada código
 * de salida tiene que estar en el catálogo de motivos. Se consulta por código
 * exacto —una consulta por variable, no un volcado del catálogo— para que un
 * inventario grande no produzca falsos «no existe» por quedarse fuera de página.
 */
export function useInventoryCheck({
  enabled,
  language,
  source,
  dependencies,
  nodes,
}: Params): InventoryCheck {
  const contract = parseContractHeader(language, source);
  const declared = enabled ? declaredVariables(dependencies) : [];
  const literalsByOutput = enabled ? assignedLiterals(nodes) : new Map<string, string[]>();
  const reasonLiterals = contract?.reasonOutputId
    ? (literalsByOutput.get(contract.reasonOutputId) ?? [])
    : [];

  const variableQueries = useQueries({
    queries: declared.map((variable) => ({
      queryKey: ['variable-search', variable.code],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        apiRequest<UnknownRecord>(
          `/v1/variables?${SEARCH}&search=${encodeURIComponent(variable.code)}`,
          { signal },
        ),
    })),
  });

  const reasonQueries = useQueries({
    queries: reasonLiterals.map((literal) => ({
      queryKey: ['reason-code-search', literal],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        apiRequest<UnknownRecord>(
          `/v1/reason-codes?${SEARCH}&search=${encodeURIComponent(literal)}`,
          { signal },
        ),
    })),
  });

  const matches = new Map<string, CatalogMatch>();
  declared.forEach((variable, index) => {
    const query = variableQueries[index];
    if (!query?.isSuccess) return;
    matches.set(variable.code, matchOf(variable.code, asRows(asRecord(query.data).items)));
  });

  // El detalle sólo hace falta para las salidas que reciben textos literales: es
  // donde el catálogo puede declarar la lista de valores admitidos.
  const outputsWithLiterals = declared.filter(
    (variable) =>
      variable.usageType.startsWith('OUTPUT') &&
      (literalsByOutput.get(variable.code)?.length ?? 0) > 0 &&
      matches.get(variable.code)?.found,
  );
  const detailQueries = useQueries({
    queries: outputsWithLiterals.map((variable) => ({
      queryKey: ['variable', matches.get(variable.code)!.found!.definitionId],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        apiRequest<UnknownRecord>(
          `/v1/variables/${encodeURIComponent(matches.get(variable.code)!.found!.definitionId)}`,
          { signal },
        ),
    })),
  });

  const allowedByOutput = new Map<string, unknown[]>();
  outputsWithLiterals.forEach((variable, index) => {
    const query = detailQueries[index];
    if (!query?.isSuccess) return;
    const allowed = allowedValuesOf(query.data);
    if (allowed) allowedByOutput.set(variable.code, allowed);
  });

  const knownReasons = new Map<string, boolean>();
  reasonLiterals.forEach((literal, index) => {
    const query = reasonQueries[index];
    if (!query?.isSuccess) return;
    const codes = asRows(asRecord(query.data).items).map((row) =>
      display(row, 'reasonCode', 'code'),
    );
    knownReasons.set(literal, codes.includes(literal));
  });

  const all = [...variableQueries, ...reasonQueries, ...detailQueries];
  const locate = locateIn(source);
  // Sin ningún texto literal en las salidas no hay códigos de salida que cotejar,
  // y pedir `reasonOutputId` sería exigir algo que ese algoritmo no usa.
  const writesLiterals = [...literalsByOutput.values()].some((values) => values.length > 0);
  const issues = enabled
    ? [
        ...variableIssues(declared, matches, locate),
        ...(contract && writesLiterals
          ? reasonIssues(contract.reasonOutputId, reasonLiterals, knownReasons, locate)
          : []),
        ...allowedValueIssues(literalsByOutput, allowedByOutput, locate),
      ]
    : [];

  return {
    issues,
    declared: declared.length,
    missing: [...matches.values()].filter((match) => !match.found).length,
    isLoading: all.some((query) => query.isLoading),
    isError: all.some((query) => query.isError),
  };
}

/** Coincidencia exacta; si no la hay, una que sólo difiera en mayúsculas. */
function matchOf(code: string, rows: UnknownRecord[]): CatalogMatch {
  const exact = rows.find((row) => display(row, 'variableCode') === code);
  if (exact) {
    return {
      found: {
        definitionId: display(exact, 'id', 'definitionId'),
        name: display(exact, 'name', 'canonicalName'),
        dataType: display(exact, 'dataType'),
      },
    };
  }
  const similar = rows.find(
    (row) => display(row, 'variableCode').toLowerCase() === code.toLowerCase(),
  );
  return similar ? { similar: display(similar, 'variableCode') } : {};
}

/** Valores permitidos de la última versión de una definición del catálogo. */
function allowedValuesOf(detail: unknown): unknown[] | undefined {
  const versions = asRows(asRecord(detail).versions);
  const latest = versions[versions.length - 1];
  if (!latest) return undefined;
  return parseConstraints(latest.constraintsJson ?? latest.validationSchemaJson).allowedValues;
}
