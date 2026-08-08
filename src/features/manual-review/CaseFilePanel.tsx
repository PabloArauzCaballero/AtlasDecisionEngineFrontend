'use client';

import { ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { DefinitionGrid } from '../../components/DefinitionGrid';
import { JsonPanel } from '../../components/JsonPanel';
import { Panel } from '../../components/Panel';
import { StatusBadge } from '../../components/StatusBadge';
import { useDetailQuery } from '../../hooks/useDetailQuery';
import { asRecord, asRows, display } from '../../utils/records';

interface CaseFilePanelProps {
  /** Identificador de la ejecución que derivó el caso, si el caso lo trae. */
  executionId: string;
}

/**
 * Expediente completo del caso: los datos con los que se decidió.
 *
 * El detalle de la revisión manual trae la cola, el motivo y una instantánea de
 * entrada; lo que NO trae es la ejecución entera —variables resueltas, salida,
 * motivos explicables—, que es justo lo que hace falta para entender por qué el
 * motor derivó el caso. Se pide aparte a `/v1/audit/executions/{id}`.
 *
 * Si el caso no referencia una ejecución, o la lectura falla por permisos, se
 * dice: un expediente a medias que no se anuncia como tal invita a decidir
 * creyendo que ya se vio todo.
 */
export function CaseFilePanel({ executionId }: CaseFilePanelProps) {
  const query = useDetailQuery<unknown>(
    'case-execution',
    executionId ? `/v1/audit/executions/${encodeURIComponent(executionId)}` : null,
  );
  const execution = asRecord(query.data);
  const variables = asRows(execution.variables);
  const reasons = asRows(execution.reasonCodes ?? execution.reasons);

  if (!executionId) {
    return (
      <Panel title="Expediente del caso" meta="Sin ejecución asociada">
        <p className="muted-note">
          El caso no referencia ninguna ejecución, así que no hay expediente que consultar más allá
          de los metadatos de la cola.
        </p>
      </Panel>
    );
  }

  if (query.isError) {
    return (
      <Panel title="Expediente del caso" meta="No disponible">
        <p className="muted-note">
          No fue posible leer la ejecución {executionId}. Puede ser un permiso de auditoría: lo que
          se ve arriba es sólo lo que trae el caso, no el expediente completo.
        </p>
      </Panel>
    );
  }

  return (
    <>
      <Panel
        title="Expediente del caso"
        meta={query.isPending ? 'Consultando…' : display(execution, 'requestId')}
      >
        <DefinitionGrid
          record={execution}
          items={[
            { label: 'Sujeto', keys: ['subjectReference', 'principalId'], mono: true },
            { label: 'Request ID', keys: ['requestId'], mono: true },
            { label: 'Artefacto', keys: ['artifactCode'], mono: true },
            { label: 'Versión', keys: ['versionNumber', 'semanticVersion'] },
            { label: 'Ambiente', keys: ['environmentCode'] },
            { label: 'Resultado', keys: ['outcome', 'businessOutcome'] },
            { label: 'Ejecutada', keys: ['createdAt'] },
          ]}
        />
        <div className="stack-actions">
          <Link className="button" href={`/executions/${encodeURIComponent(executionId)}`}>
            <ExternalLink size={16} /> Ver la ejecución completa
          </Link>
        </div>
      </Panel>
      {reasons.length ? (
        <Panel title="Motivos de la decisión" meta={`${reasons.length} motivos`}>
          <ul className="case-reason-list">
            {reasons.map((reason) => (
              <li key={display(reason, 'reasonCode', 'code')}>
                <code>{display(reason, 'reasonCode', 'code')}</code>
                <span>{display(reason, 'publicMessage', 'message', 'description')}</span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
      <Panel title="Datos del solicitante" meta={`${variables.length} variables resueltas`}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Variable</th>
                <th>Valor</th>
                <th>Origen</th>
              </tr>
            </thead>
            <tbody>
              {variables.map((item) => (
                <tr key={display(item, 'id', 'variableCode')}>
                  <td className="mono">{display(item, 'variableCode', 'name')}</td>
                  <td>{display(item, 'valueJson', 'value')}</td>
                  <td>
                    <StatusBadge value={item.sourceType ?? item.source} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!query.isPending && !variables.length ? (
          <p className="muted-note">
            La ejecución no publicó variables resueltas. La instantánea de entrada está más abajo.
          </p>
        ) : null}
      </Panel>
      <JsonPanel
        label="Entrada original"
        value={execution.inputJson ?? execution.inputSnapshot ?? {}}
      />
    </>
  );
}
