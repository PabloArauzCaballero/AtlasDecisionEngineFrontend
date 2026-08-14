'use client';

import { ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { canConsultCaseFile } from '../../auth/business-rules';
import { useEffectiveRoles } from '../../auth/useAuth';
import { Alert } from '../../components/Alert';
import { DefinitionGrid } from '../../components/DefinitionGrid';
import { JsonPanel } from '../../components/JsonPanel';
import { Panel } from '../../components/Panel';
import { StatusBadge } from '../../components/StatusBadge';
import { useDetailQuery } from '../../hooks/useDetailQuery';
import { asRecord, asRows, display } from '../../utils/records';
import { maskValue, sensitiveCodesOfExecution } from '../../utils/sensitivity';
import { ScrollRegion } from '../../components/ScrollRegion';

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
  const roles = useEffectiveRoles();
  /*
   * El permiso se comprueba AQUÍ y no en la página que monta el panel.
   *
   * `canConsultCaseFile` existía, estaba documentado y tenía prueba unitaria en
   * verde desde el principio —y ni una sola llamada—: la página pintaba el
   * expediente a cualquiera que pudiera abrir el caso. Un control que hay que
   * acordarse de invocar en cada sitio de uso acaba así, y el test verde hacía
   * parecer que estaba aplicado. Dentro del componente viaja con él.
   *
   * Sigue sin ser el control real: el motor gatea `/v1/audit/executions/{id}`
   * con sus propios roles. Éste evita pedir un dato que no toca y explicar por
   * qué no se ve, en vez de enseñar un error de permisos crudo.
   */
  const allowed = canConsultCaseFile(roles);
  const query = useDetailQuery<unknown>(
    'case-execution',
    allowed && executionId ? `/v1/audit/executions/${encodeURIComponent(executionId)}` : null,
  );
  const execution = asRecord(query.data);
  const variables = asRows(execution.variables);
  const reasons = asRows(execution.reasonCodes ?? execution.reasons);
  const sensitiveCodes = sensitiveCodesOfExecution(execution);

  if (!allowed) {
    return (
      <Panel title="Expediente del caso" meta="Sin permiso">
        <p className="muted-note">
          Ver el expediente —datos del solicitante, variables resueltas y entrada original— requiere
          rol Risk Analyst, Fraud Analyst u Operations. Lo que se ve arriba son los metadatos de la
          cola, que no incluyen datos personales.
        </p>
      </Panel>
    );
  }

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
      {/*
        Los motivos se pintan SIEMPRE, incluso vacíos.
        Antes el panel entero desaparecía cuando la ejecución no publicaba
        ninguno (`reasons.length ? … : null`), y en un expediente eso se lee como
        «esta decisión no necesitaba motivos». Es al revés: una decisión adversa
        sin motivo publicado es lo que hay que ver, porque es lo que impide
        comunicárselo al solicitante —y comunicarlo es exigible tanto aquí como
        en el mercado estadounidense—. Sus paneles hermanos ya avisaban cuando
        no traían datos; éste era el único que se escondía.
      */}
      <Panel
        title="Motivos de la decisión"
        meta={reasons.length ? `${reasons.length} motivos` : 'ninguno publicado'}
      >
        {reasons.length ? (
          <ul className="case-reason-list">
            {reasons.map((reason) => (
              <li key={display(reason, 'reasonCode', 'code')}>
                <code>{display(reason, 'reasonCode', 'code')}</code>
                <span>{display(reason, 'publicMessage', 'message', 'description')}</span>
              </li>
            ))}
          </ul>
        ) : query.isPending ? (
          <p className="muted-note">Consultando…</p>
        ) : (
          <Alert tone="warning">
            La ejecución no publicó ningún motivo. Sin motivo no se puede explicar la decisión al
            solicitante ni filtrar el caso por su causa: antes de resolver, comprueba que el
            artefacto emita una acción del catálogo de motivos.
          </Alert>
        )}
      </Panel>
      <Panel title="Datos del solicitante" meta={`${variables.length} variables resueltas`}>
        <ScrollRegion label="Datos del solicitante">
          <table>
            <thead>
              <tr>
                <th scope="col">Variable</th>
                <th scope="col">Valor</th>
                <th scope="col">Origen</th>
              </tr>
            </thead>
            <tbody>
              {variables.map((item) => (
                <tr key={display(item, 'id', 'variableCode')}>
                  <td className="mono">{display(item, 'variableCode', 'name')}</td>
                  <td>{maskValue(item.valueJson ?? item.value, item.sensitivityClass)}</td>
                  <td>
                    <StatusBadge value={item.sourceType ?? item.source} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollRegion>
        {!query.isPending && !variables.length ? (
          <p className="muted-note">
            La ejecución no publicó variables resueltas. La instantánea de entrada está más abajo.
          </p>
        ) : null}
      </Panel>
      <JsonPanel
        label="Entrada original"
        tutorialId="case-input"
        value={execution.inputJson ?? execution.inputSnapshot ?? {}}
        sensitiveCodes={sensitiveCodes}
      />
    </>
  );
}
