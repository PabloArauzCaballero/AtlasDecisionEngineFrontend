'use client';

import { useQuery } from '@tanstack/react-query';
import { SlidersHorizontal } from 'lucide-react';
import { apiRequest } from '../../api/http-client';
import { NavLink } from '../../navigation/NavLink';
import { describeConstraints, parseConstraints } from '../../contracts/constraints';
import { asRecord, asRows, type UnknownRecord } from '../../utils/records';

interface Props {
  /** Definición del catálogo; sin ella no se puede consultar el contrato. */
  definitionId: string;
  /** Versión declarada en el grafo, para describir la que de verdad se usa. */
  version?: number;
}

/**
 * Resume las restricciones de una variable de entrada y enlaza a su contrato.
 *
 * Las restricciones pertenecen a la DEFINICIÓN de la variable, no al grafo que la
 * usa: una versión de variable queda inmutable en cuanto un artefacto la emplea.
 * Por eso aquí solo se muestran —para que quien diseña el flujo sepa qué se va a
 * exigir al publicar— y se edita en el catálogo, no en el editor.
 *
 * El picker de variables (`/v1/views/pickers/variables`) no trae las restricciones;
 * viven en el detalle, que se consulta con la misma queryKey que la página del
 * catálogo para que React Query lo comparta en lugar de pedirlo dos veces.
 */
export function InputConstraintBadge({ definitionId, version }: Props) {
  const detail = useQuery({
    queryKey: ['variable', definitionId],
    queryFn: ({ signal }) =>
      apiRequest<UnknownRecord>(`/v1/variables/${encodeURIComponent(definitionId)}`, { signal }),
    enabled: Boolean(definitionId),
  });

  if (!definitionId) return null;

  const versions = asRows(asRecord(detail.data).versions);
  const used =
    versions.find((item) => Number(item.versionNumber) === version) ??
    versions[versions.length - 1] ??
    {};
  const parts = describeConstraints(
    parseConstraints(used.constraintsJson ?? used.validationSchemaJson),
  );

  const summary = detail.isLoading
    ? 'Consultando restricciones…'
    : detail.isError
      ? 'No se pudieron leer las restricciones'
      : parts.length
        ? parts.join(' · ')
        : 'Sin restricciones declaradas';

  return (
    <NavLink
      href={`/variables/${encodeURIComponent(definitionId)}`}
      className="input-constraint-badge"
      showSpinner={false}
    >
      <SlidersHorizontal size={11} aria-hidden />
      <span>{summary}</span>
      <span className="sr-only">Ver y editar el contrato de esta variable en el catálogo</span>
    </NavLink>
  );
}
