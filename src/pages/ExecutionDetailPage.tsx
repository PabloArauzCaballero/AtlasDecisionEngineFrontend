import { Copy, FileDown, GitBranch } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert } from '../components/Alert';
import { ConfirmButton } from '../components/ConfirmButton';
import type { AmbientState } from '../components/AmbientBackground';
import { useAmbientState } from '../components/ambient/useAmbientState';
import { downloadGeneratedDocument } from '../features/documents/documents.api';
import {
  buildExecutionReport,
  executionReportFileName,
} from '../features/documents/execution-report';
import { saveFile } from '../features/documents/save-file';
import { ExecutionPlayback } from '../features/execution-playback/ExecutionPlayback';
import { normalizeTrace } from '../features/execution-playback/execution-trace';
import { NodeVariableStatePanel } from '../features/graph-editor/NodeVariableStatePanel';
import { DefinitionGrid } from '../components/DefinitionGrid';
import { JsonPanel } from '../components/JsonPanel';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { StatusBadge } from '../components/StatusBadge';
import { Timeline } from '../components/Timeline';
import { useDetailQuery } from '../hooks/useDetailQuery';
import { asRecord, asRows, display } from '../utils/records';
import { maskValue, sensitiveCodesOfExecution } from '../utils/sensitivity';
import { ScrollRegion } from '../components/ScrollRegion';

interface ExecutionDetailPageProps {
  executionId: string;
}

export function ExecutionDetailPage({ executionId }: ExecutionDetailPageProps) {
  const query = useDetailQuery<unknown>(
    'execution-detail',
    executionId ? `/v1/audit/executions/${encodeURIComponent(executionId)}` : null,
  );
  const execution = asRecord(query.data);
  const variables = asRows(execution.variables);
  const trace = asRows(execution.traceSteps ?? execution.trace);
  /*
   * Qué variables clasificó el catálogo como personales. La traza por nodo ya
   * las enmascaraba; esta pantalla —la tabla de variables resueltas y los dos
   * paneles de JSON— las pintaba en claro, y además las ofrecía en el
   * portapapeles y en un archivo descargable.
   */
  const sensitiveCodes = sensitiveCodesOfExecution(execution);
  const versionId = display(execution, 'artifactVersionId', 'versionId');
  const router = useRouter();
  // El grafo de la versión ejecutada es lo que da forma a la reproducción. Se
  // pide sólo cuando la ejecución referencia una versión; si falla, el modo de
  // reproducción sigue funcionando con su línea de tiempo.
  const graphQuery = useDetailQuery<unknown>(
    'execution-version-graph',
    versionId !== '—' ? `/v1/artifact-versions/${encodeURIComponent(versionId)}/graph` : null,
  );
  const graph = asRecord(graphQuery.data);
  const steps = normalizeTrace(execution);

  /**
   * Entrega la entrada original al simulador por `sessionStorage` —el payload
   * excede lo que tolera una cadena de consulta— y navega allí.
   *
   * Va SIN enmascarar a propósito: reproducir una decisión con `•••` en lugar
   * del ingreso o del documento no reproduce nada. Por eso el gesto se confirma
   * cuando hay datos personales de por medio (ver abajo): es la única vía del
   * portal que copia el expediente en claro a otro sitio —`sessionStorage`, que
   * sobrevive a la navegación y no se borra al cambiar de vista—, y quien la usa
   * debe saber que lo está haciendo.
   */
  /*
   * El informe de la ejecución, por el generador documental del motor.
   *
   * Lo arma `buildExecutionReport` y lo maqueta el worker: esta pantalla no sabe nada de
   * maquetación, sólo de qué tiene que contar. La descarga va por la puerta autenticada
   * (`downloadGeneratedDocument`) y no por un enlace: un `<a download>` es una navegación, ahí no
   * viaja el `Authorization`, y lo que se guardaría en disco sería el 401.
   */
  const [generandoPdf, setGenerandoPdf] = useState(false);
  const [errorPdf, setErrorPdf] = useState<string | null>(null);

  const descargarPdf = async () => {
    setGenerandoPdf(true);
    setErrorPdf(null);
    try {
      const archivo = await downloadGeneratedDocument({
        templateId: 'generic-result-report',
        payload: buildExecutionReport(execution),
        filename: executionReportFileName(execution),
      });
      saveFile(archivo.blob, archivo.fileName);
    } catch (error) {
      setErrorPdf(
        error instanceof Error ? error.message : 'No fue posible generar el informe en PDF.',
      );
    } finally {
      setGenerandoPdf(false);
    }
  };

  const cloneToSimulator = () => {
    const input = asRecord(execution.inputJson ?? execution.inputSnapshot);
    sessionStorage.setItem(
      'simulator-prefill',
      JSON.stringify({
        artifactCode: display(execution, 'artifactCode'),
        variables: input.variables ?? input,
      }),
    );
    router.push('/simulator');
  };

  // El fondo toma la temperatura del desenlace real de la ejecución.
  const outcome = display(execution, 'status', 'outcome').toUpperCase();
  const ambient: AmbientState = steps.some((step) => step.status === 'error')
    ? 'error'
    : /FAIL|ERROR|REJECT/.test(outcome)
      ? 'error'
      : query.data
        ? 'success'
        : 'idle';
  useAmbientState(ambient);

  return (
    <>
      <PageHeader
        eyebrow="F6-02 · Auditoría"
        title="Ejecución de la transacción"
        description={`${display(execution, 'requestId')} · ${display(execution, 'artifactCode')}`}
        actions={
          <>
            {/*
              Se confirma SÓLO si la ejecución trae datos clasificados. Preguntar
              siempre convertiría el aviso en un trámite que se acepta sin leer, y
              entonces dejaría de avisar de nada.
            */}
            {sensitiveCodes.size ? (
              <ConfirmButton
                className="button"
                title="Clonar copia datos personales"
                confirmLabel="Clonar de todos modos"
                description={
                  <>
                    Esta ejecución contiene {sensitiveCodes.size}{' '}
                    {sensitiveCodes.size === 1 ? 'variable clasificada' : 'variables clasificadas'}{' '}
                    como dato personal ({[...sensitiveCodes].slice(0, 4).join(', ')}
                    {sensitiveCodes.size > 4 ? '…' : ''}). El simulador las recibe{' '}
                    <strong>en claro</strong>, porque con la máscara puesta no reproducirían la
                    decisión, y quedan en el almacenamiento de esta pestaña hasta que la cierres.
                  </>
                }
                disabled={!query.data}
                onConfirm={cloneToSimulator}
              >
                <Copy size={16} /> Clonar
              </ConfirmButton>
            ) : (
              <button
                className="button"
                type="button"
                disabled={!query.data}
                onClick={cloneToSimulator}
                title="Reproducir esta transacción en el simulador"
              >
                <Copy size={16} /> Clonar
              </button>
            )}
            <button
              className="button"
              type="button"
              disabled={!query.data || generandoPdf}
              onClick={() => void descargarPdf()}
              title="Descargar el informe de esta ejecución en PDF"
              data-testid="descargar-pdf-ejecucion"
            >
              <FileDown size={16} /> {generandoPdf ? 'Generando…' : 'Descargar PDF'}
            </button>
            {versionId !== '—' ? (
              <Link
                className="button button-primary"
                href={`/artifact-versions/${encodeURIComponent(versionId)}/graph`}
              >
                <GitBranch size={16} /> Ver Grafo
              </Link>
            ) : (
              <button
                className="button button-primary"
                type="button"
                disabled
                title="La ejecución no referencia una versión de grafo"
              >
                <GitBranch size={16} /> Ver Grafo
              </button>
            )}
          </>
        }
      />
      {query.isError ? <Alert tone="error">No fue posible recuperar la ejecución.</Alert> : null}
      {errorPdf ? <Alert tone="error">{errorPdf}</Alert> : null}
      <div className="execution-summary">
        <StatusBadge value={execution.status ?? 'COMPLETADO'} />
        <strong>{display(execution, 'outcome')}</strong>
        <span>{display(execution, 'durationMs')} ms</span>
      </div>
      <Panel title="Metadatos de contexto" meta="instantánea inmutable">
        <DefinitionGrid
          record={execution}
          items={[
            { label: 'ID de petición', keys: ['requestId'], mono: true },
            { label: 'Artefacto', keys: ['artifactCode'], mono: true },
            { label: 'Versión', keys: ['versionNumber', 'semanticVersion'] },
            { label: 'Ambiente', keys: ['environmentCode'] },
            { label: 'Principal', keys: ['principalId'], mono: true },
            { label: 'Ejecutada', keys: ['createdAt'] },
          ]}
        />
      </Panel>
      <Panel title="Reproducción de la decisión" meta={`${steps.length} pasos trazados`}>
        <ExecutionPlayback steps={steps} nodes={asRows(graph.nodes)} edges={asRows(graph.edges)} />
      </Panel>
      {/* Columnas de maquetación, no landmarks: el `<main>` del portal es el de
          `NextAppShell` y sólo puede haber uno. */}
      <div className="execution-detail-grid">
        <div>
          <JsonPanel
            label="Entrada original"
            tutorialId="execution-input"
            value={execution.inputJson ?? execution.inputSnapshot ?? {}}
            sensitiveCodes={sensitiveCodes}
          />
          <JsonPanel
            label="Salida de la decisión"
            tutorialId="execution-output"
            value={execution.outputJson ?? execution.output ?? {}}
            sensitiveCodes={sensitiveCodes}
          />
          <Panel title="Variables resueltas" meta={`${variables.length} variables`}>
            <ScrollRegion label="Variables resueltas">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Nombre de la variable</th>
                    <th scope="col">Valor final</th>
                    <th scope="col">Origen (resolutor)</th>
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
          </Panel>
        </div>
        <div className="execution-detail-side">
          <Panel title="Línea de tiempo de la ejecución" meta={`${trace.length} pasos`}>
            <Timeline
              items={trace.map((item) => ({
                title: display(item, 'nodeKey', 'nodeType'),
                detail: display(item, 'branchTaken', 'evaluation'),
                meta: `${display(item, 'durationUs')} μs`,
              }))}
            />
          </Panel>
        </div>
      </div>
      {/*
        El estado por nodo va a lo ancho, fuera de la rejilla.
        Medido en el navegador: dentro del `aside` el contenedor daba 294 px para
        una tabla que necesita 622 —seis columnas: variable, antes, después,
        productora, creada en, consumida por—. Desplazaba, sí, pero enseñaba
        menos de la mitad, y una barra horizontal dentro de un panel es fácil de
        no ver: se leía como cortada. La línea de tiempo sí cabe en la columna,
        porque es una lista estrecha; esta tabla no.
      */}
      <Panel title="Estado de variables por nodo" meta="entradas · intermedias · salidas">
        <NodeVariableStatePanel trace={trace} />
      </Panel>
    </>
  );
}
