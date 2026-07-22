import { AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { errorMessage } from '../api/ApiError';
import { Alert } from '../components/Alert';
import { ModalDialog } from '../components/ModalDialog';
import { EdgeProperties } from '../features/graph-editor/EdgeProperties';
import { GraphCanvas } from '../features/graph-editor/GraphCanvas';
import { GraphEditorToolbar } from '../features/graph-editor/GraphEditorToolbar';
import { GraphValidationModal } from '../features/graph-editor/GraphValidationModal';
import { NodeLibrary } from '../features/graph-editor/NodeLibrary';
import { NodeProperties } from '../features/graph-editor/NodeProperties';
import { InputVariableManager } from '../features/graph-editor/InputVariableManager';
import { OutputVariableManager } from '../features/graph-editor/OutputVariableManager';
import { useGraphEditor } from '../features/graph-editor/useGraphEditor';
import { useUnsavedChangesGuard } from '../shared/navigation/unsaved-changes';
import { asRecord, display } from '../utils/records';

interface GraphEditorPageProps {
  initialVersionId?: string;
}

export function GraphEditorPage({ initialVersionId = '' }: GraphEditorPageProps) {
  const editor = useGraphEditor(initialVersionId);
  const [validationOpen, setValidationOpen] = useState(false);
  const [dismissedError, setDismissedError] = useState<unknown>(null);
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
        onLoad={() => editor.load.mutate()}
        onUndo={editor.undo}
        onRedo={editor.redo}
        onZoomOut={editor.zoomOut}
        onZoomIn={editor.zoomIn}
        onResetZoom={editor.resetZoom}
        onAutoLayout={editor.autoLayout}
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
          title="No se pudo completar la operación"
          subtitle={editor.save.error ? 'Al guardar el algoritmo' : 'Al cargar la versión'}
          tone="danger"
          icon={<AlertCircle size={20} />}
          onClose={() => setDismissedError(blockingError)}
          actions={
            <button
              type="button"
              className="button button-primary"
              onClick={() => setDismissedError(blockingError)}
            >
              Cerrar
            </button>
          }
        >
          <p>{errorMessage(blockingError)}</p>
        </ModalDialog>
      ) : null}
      <div className="graph-editor-statusbar">
        <div className="graph-authoring-steps" aria-label="Progreso del diseño">
          <span className={hasVersion ? 'complete' : 'current'}>
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
      </div>
      <InputVariableManager variables={editor.variables} onChange={editor.changeVariables} />
      <OutputVariableManager variables={editor.variables} onChange={editor.changeVariables} />
      <div className="graph-workbench">
        <NodeLibrary onAddNode={editor.addNode} />
        <GraphCanvas
          nodes={editor.nodes}
          edges={editor.edges}
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
            condition={asRecord(editor.selectedCondition)}
            branchCount={selectedNodeBranchCount}
            onConditionChange={editor.updateSelectedCondition}
            onChange={editor.updateSelectedNode}
            onDelete={editor.deleteSelectedNode}
          />
        )}
      </div>
    </div>
  );
}
