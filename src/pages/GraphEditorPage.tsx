import { AlertCircle, GraduationCap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { errorMessage } from '../api/ApiError';
import { Alert } from '../components/Alert';
import { useAmbientState } from '../components/ambient/useAmbientState';
import { ModalDialog } from '../components/ModalDialog';
import { ActionCatalogPanel } from '../features/graph-editor/ActionCatalogPanel';
import { EdgeProperties } from '../features/graph-editor/EdgeProperties';
import { GraphCanvas } from '../features/graph-editor/GraphCanvas';
import { GraphEditorToolbar } from '../features/graph-editor/GraphEditorToolbar';
import { GraphNotesPanel } from '../features/graph-editor/GraphNotesPanel';
import { FlowPathsPanel } from '../features/graph-editor/FlowPathsPanel';
import { FlowChecklist } from '../features/graph-editor/FlowChecklist';
import { GraphValidationModal } from '../features/graph-editor/GraphValidationModal';
import { NodeLibrary } from '../features/graph-editor/NodeLibrary';
import { NodeProperties } from '../features/graph-editor/NodeProperties';
import { InputVariableManager } from '../features/graph-editor/InputVariableManager';
import { OutputVariableManager } from '../features/graph-editor/OutputVariableManager';
import { IntermediateVariableManager } from '../features/graph-editor/IntermediateVariableManager';
import { OutputContractPanel } from '../features/graph-editor/OutputContractPanel';
import { useGraphEditor } from '../features/graph-editor/useGraphEditor';
import { tutorialCodeFor } from '../features/tutorial/error-tutorial';
import { errorTutorial } from '../features/tutorial/interactive-catalog';
import { TutorialMenu } from '../features/tutorial/TutorialMenu';
import { useInteractiveTutorial } from '../features/tutorial/useInteractiveTutorial';
import { useUnsavedChangesGuard } from '../shared/navigation/unsaved-changes';
import { asRecord, display } from '../utils/records';

interface GraphEditorPageProps {
  initialVersionId?: string;
}

export function GraphEditorPage({ initialVersionId = '' }: GraphEditorPageProps) {
  const editor = useGraphEditor(initialVersionId);
  const [validationOpen, setValidationOpen] = useState(false);
  // Detalle activado por defecto: quien abre el editor quiere entender el flujo
  // antes que verlo compacto. Se puede apagar para grafos con muchos nodos.
  const [detailed, setDetailed] = useState(true);
  const [dismissedError, setDismissedError] = useState<unknown>(null);

  // Fase 3 QA fix: opening this page by URL (e.g. the artifact detail "View Graph"
  // link) used to leave the canvas empty until "Load" was pressed. Auto-load on the
  // route's version id; passing it explicitly avoids racing the hook's versionId state.
  const loadGraph = editor.load.mutate;
  const setVersionId = editor.setVersionId;
  useEffect(() => {
    if (!initialVersionId) return;
    setVersionId(initialVersionId);
    loadGraph(initialVersionId);
  }, [initialVersionId, loadGraph, setVersionId]);
  useUnsavedChangesGuard(
    editor.canUndo,
    '¿Estás seguro de que quieres dejar el algoritmo inconcluso? El diseño del grafo tiene cambios sin guardar.',
  );
  const blockingError = editor.load.error ?? editor.save.error;
  const showErrorModal = Boolean(blockingError) && blockingError !== dismissedError;
  const hasVersion = Boolean(editor.versionId.trim());
  const hasFlow = editor.nodes.length > 0;
  const hasConnections = editor.edges.length > 0;

  const selectedNodeBranchCount = editor.edges.filter(
    (edge) => display(edge, 'from') === editor.selectedKey,
  ).length;
  const selectedEdgeSource = editor.nodes.find(
    (node) => display(node, 'key') === display(asRecord(editor.selectedEdge), 'from'),
  );
  const selectedEdgeSourceType = selectedEdgeSource ? display(selectedEdgeSource, 'type') : '';

  // Un fallo del motor no queda en un mensaje técnico opaco: el diálogo usa la
  // explicación del catálogo y ofrece el recorrido que enseña a corregirlo.
  const { startForError } = useInteractiveTutorial();
  const errorTutorialCode = tutorialCodeFor(blockingError);
  const errorTutorialLink = errorTutorialCode ? errorTutorial(errorTutorialCode) : null;

  // Guardar y validar son viajes reales al motor: el fondo lo refleja mientras
  // duran, y sólo mientras duran.
  useAmbientState(editor.save.isPending || editor.validate.isPending ? 'running' : 'idle');

  return (
    <div className="graph-editor-page">
      <GraphEditorToolbar
        versionId={editor.versionId}
        canUndo={editor.canUndo}
        canRedo={editor.canRedo}
        connectMode={editor.connectMode}
        zoom={editor.zoom}
        loading={editor.load.isPending}
        saving={editor.save.isPending}
        validating={editor.validate.isPending}
        onVersionIdChange={editor.setVersionId}
        onLoad={() => editor.load.mutate(undefined)}
        onUndo={editor.undo}
        onRedo={editor.redo}
        onZoomOut={editor.zoomOut}
        onZoomIn={editor.zoomIn}
        onResetZoom={editor.resetZoom}
        onAutoLayout={editor.autoLayout}
        detailed={detailed}
        onToggleDetail={() => setDetailed((value) => !value)}
        onToggleConnect={editor.toggleConnectMode}
        onValidate={() => {
          setValidationOpen(true);
          editor.validate.mutate();
        }}
        onSave={() => editor.save.mutate()}
      />
      {editor.save.isSuccess ? <Alert tone="success">Cambios guardados.</Alert> : null}
      {validationOpen &&
      (editor.validate.isPending || editor.validate.data || editor.validate.error) ? (
        <GraphValidationModal
          isPending={editor.validate.isPending}
          data={editor.validate.data}
          error={editor.validate.error}
          onClose={() => setValidationOpen(false)}
        />
      ) : null}
      {showErrorModal ? (
        <ModalDialog
          title={errorTutorialLink ? errorTutorialLink.title : 'No se pudo completar la operación'}
          subtitle={editor.save.error ? 'Al guardar el algoritmo' : 'Al cargar la versión'}
          tone="danger"
          icon={<AlertCircle size={20} />}
          onClose={() => setDismissedError(blockingError)}
          actions={
            <>
              {/* El recorrido guiado va DENTRO del diálogo: antes el mismo fallo
                  llegaba además como aviso, y era ahí donde estaba la única forma
                  de llegar al tutorial. */}
              {errorTutorialLink ? (
                <button
                  type="button"
                  className="button"
                  onClick={() => {
                    setDismissedError(blockingError);
                    startForError(errorTutorialCode as string);
                  }}
                >
                  <GraduationCap size={16} /> Ver tutorial guiado
                </button>
              ) : null}
              <button
                type="button"
                className="button button-primary"
                onClick={() => setDismissedError(blockingError)}
              >
                Cerrar
              </button>
            </>
          }
        >
          <p>{errorTutorialLink ? errorTutorialLink.description : errorMessage(blockingError)}</p>
        </ModalDialog>
      ) : null}
      <div className="graph-editor-statusbar">
        <div className="graph-authoring-steps" aria-label="Progreso del diseño">
          <span className={hasVersion ? 'complete' : 'current'} data-tutorial-id="graph-load">
            <b>1</b> Cargar versión
          </span>
          <span className={hasFlow ? 'complete' : hasVersion ? 'current' : ''}>
            <b>2</b> Diseñar flujo
          </span>
          <span className={hasConnections ? 'complete' : hasFlow ? 'current' : ''}>
            <b>3</b> Conectar rutas
          </span>
          <span
            className={editor.validate.isSuccess ? 'complete' : hasConnections ? 'current' : ''}
          >
            <b>4</b> Validar
          </span>
        </div>
        <div className="graph-editor-counts">
          <span>
            <strong>{editor.nodes.length}</strong> nodos
          </span>
          <span>
            <strong>{editor.edges.length}</strong> conexiones
          </span>
        </div>
        <TutorialMenu />
      </div>
      <InputVariableManager variables={editor.variables} onChange={editor.changeVariables} />
      <OutputVariableManager variables={editor.variables} onChange={editor.changeVariables} />
      <IntermediateVariableManager
        intermediates={editor.intermediates}
        nodes={editor.nodes}
        onChange={editor.changeIntermediates}
      />
      <OutputContractPanel
        variables={editor.variables}
        intermediates={editor.intermediates}
        nodes={editor.nodes}
        outputContract={editor.outputContract}
        onChange={editor.changeOutputContract}
      />
      <ActionCatalogPanel
        actions={editor.actions}
        nodes={editor.nodes}
        onChange={editor.changeActions}
      />
      {/* Todas las posibilidades del árbol, en orden. Va junto a la revisión de
          flujo porque responden a la misma pregunta desde dos ángulos: aquélla
          dice qué está mal; ésta, qué le pasa a cada tipo de caso. */}
      <FlowPathsPanel nodes={editor.nodes} edges={editor.edges} onSelectNode={editor.selectNode} />
      <FlowChecklist
        nodes={editor.nodes}
        edges={editor.edges}
        inputs={editor.inputs}
        outputs={editor.outputs}
        actions={editor.actions}
        onSelectNode={editor.selectNode}
      />
      {hasVersion ? <GraphNotesPanel versionId={editor.versionId} /> : null}
      <div className="graph-workbench">
        <NodeLibrary onAddNode={editor.addNode} />
        <GraphCanvas
          nodes={editor.nodes}
          edges={editor.edges}
          conditions={editor.conditions}
          actions={editor.actions}
          variables={editor.variables}
          loading={editor.load.isPending}
          detailed={detailed}
          selectedKey={editor.selectedKey}
          selectedEdgeKey={editor.selectedEdgeKey}
          pendingFrom={editor.pendingFrom}
          connectMode={editor.connectMode}
          connectionNotice={editor.connectionNotice}
          zoom={editor.zoom}
          onNodeClick={editor.handleNodeClick}
          onMoveNode={editor.moveNode}
          onDragStart={editor.beginDrag}
          onDragEnd={editor.endDrag}
          onDropNode={(type, x, y) => editor.addNode(type, { x, y })}
          onEdgeClick={editor.selectEdge}
          onCancelConnection={editor.cancelConnection}
          onAddStart={() => editor.addNode('START', { x: 8, y: 43 })}
        />
        {editor.selectedEdgeKey ? (
          <EdgeProperties
            edge={asRecord(editor.selectedEdge)}
            conditions={editor.conditions}
            inputs={editor.inputs}
            isSwitchBranch={selectedEdgeSourceType === 'SWITCH'}
            onChange={editor.updateSelectedEdge}
            onEditCondition={editor.updateConditionByCode}
            onDelete={() => editor.deleteEdge(editor.selectedEdgeKey)}
            onClose={editor.closeEdge}
          />
        ) : (
          <NodeProperties
            node={asRecord(editor.selected)}
            outputs={editor.outputs}
            inputs={editor.inputs}
            conditions={editor.conditions}
            actions={editor.actions}
            variables={editor.variables}
            intermediates={editor.intermediates}
            condition={asRecord(editor.selectedCondition)}
            branchCount={selectedNodeBranchCount}
            versionId={editor.versionId}
            onConditionChange={editor.updateSelectedCondition}
            onCreateCondition={editor.createSelectedNodeCondition}
            onChange={editor.updateSelectedNode}
            onDelete={editor.deleteSelectedNode}
          />
        )}
      </div>
    </div>
  );
}
