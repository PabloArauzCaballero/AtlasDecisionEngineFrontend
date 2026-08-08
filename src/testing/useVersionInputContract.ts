'use client';

import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../api/http-client';
import { asRecord, asRows, display, type UnknownRecord } from '../utils/records';

/** Una variable de entrada, ya normalizada para pintar un control. */
export interface ContractInput {
  code: string;
  dataType: string;
  required: boolean;
  displayName: string;
  /** Valores admitidos, si el contrato los cierra. */
  allowed: string[];
  sensitive: boolean;
}

const NONE: ContractInput[] = [];

/**
 * Contrato de entrada de UNA versión concreta.
 *
 * Se lee del grafo de la versión (`/v1/artifact-versions/:id/graph`) y no del
 * catálogo por código de artefacto: una suite prueba **la versión que se le
 * asignó**, y el catálogo devuelve el contrato de la última: sembrar un caso
 * con variables que esa versión no declara produce un 422 al guardarlo, o peor,
 * un caso que pasa por casualidad.
 *
 * Los nombres se normalizan aquí porque el grafo dice `code`/`required` y el
 * catálogo `variableCode`/`isRequired`: sin esto, cada vista tendría que saber
 * de qué endpoint vino su dato.
 */
export function useVersionInputContract(artifactVersionId: string | undefined) {
  const id = (artifactVersionId ?? '').trim();
  const query = useQuery({
    queryKey: ['version-input-contract', id],
    enabled: id !== '',
    queryFn: ({ signal }) =>
      apiRequest<UnknownRecord>(`/v1/artifact-versions/${encodeURIComponent(id)}/graph`, {
        signal,
      }),
    select: (graph) =>
      asRows(graph.variables)
        .filter((variable) => display(variable, 'usageType').startsWith('INPUT'))
        .map(toContractInput),
  });

  return {
    inputs: query.data ?? NONE,
    isPending: query.isPending,
    isError: query.isError,
    /** La versión no declara ninguna entrada: el formulario no puede ofrecer nada. */
    isEmpty: query.isSuccess && (query.data?.length ?? 0) === 0,
  };
}

function toContractInput(variable: UnknownRecord): ContractInput {
  const schema = asRecord(variable.validationSchema);
  const code = display(variable, 'code', 'variableCode');
  return {
    code,
    dataType: display(variable, 'dataType').toUpperCase(),
    required: variable.required === true || variable.isRequired === true,
    displayName: display(variable, 'displayName', 'canonicalName', 'code'),
    allowed: Array.isArray(schema.enum) ? schema.enum.map(String) : [],
    // Un valor sensible se puede escribir, pero la vista avisa: un caso de
    // prueba versionado con un dato personal real dentro es una fuga guardada.
    // La clase se compara contra la lista cerrada y no contra «hay clase»:
    // `INTERNAL` es una clase y no es sensible.
    sensitive:
      variable.sensitive === true || SENSITIVE.includes(display(variable, 'sensitivityClass')),
  };
}

/** Clases que exigen aviso, las mismas que enmascara la traza de ejecución. */
const SENSITIVE = ['PII', 'SENSITIVE_PII', 'SECRET'];
