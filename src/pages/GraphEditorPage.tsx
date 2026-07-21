import { errorMessage } from '../api/ApiError';
import { Alert } from '../components/Alert';
import { JsonPanel } from '../components/JsonPanel';
import { EdgeProperties } from '../features/graph-editor/EdgeProperties';
import { GraphCanvas } from '../features/graph-editor/GraphCanvas';
import { GraphEditorToolbar } from '../features/graph-editor/GraphEditorToolbar';
import { NodeLibrary } from '../features/graph-editor/NodeLibrary';
import { NodeProperties } from '../features/graph-editor/NodeProperties';
import { OutputVariableManager } from '../features/graph-editor/OutputVariableManager';
import { useGraphEditor } from '../features/graph-editor/useGraphEditor';
import { asRecord } from '../utils/records';

interface GraphEditorPageProps {
  initialVersionId?: string;
}

export function GraphEditorPage({ initialVersionId = '' }: GraphEditorPageProps) {
  const editor = useGraphEditor(initialVersionId);
  const requestError = editor.load.error ?? editor.save.error ?? editor.validate.error;

  return (
    <div className="graph-editor-page">
      <GraphEditorToolbar
        versionId={editor.versionId}
        canUndo={editor.canUndo}
        canRedo={editor.canRedo}
        connectMode={editor.connectMode}
        loading={editor.load.isPending}
        saving={editor.save.isPending}
        validating={editor.validate.isPending}
        onVersionIdChange={editor.setVersionId}
        onLoad={() => editor.load.mutate(undefined)}
        onUndo={editor.undo}
        onRedo={editor.redo}
        onZoomOut={editor.zoomOut}
        onZoomIn={editor.zoomIn}
        onToggleConnect={editor.toggleConnectMode}
        onValidate={() => editor.validate.mutate()}
        onSave={() => editor.save.mutate()}
      />
      {requestError ? <Alert tone="error">{errorMessage(requestError)}</Alert> : null}
      {editor.save.isSuccess ? <Alert tone="success">Cambios guardados.</Alert> : null}
      {editor.validate.isSuccess ? (
        <JsonPanel label="Resultado de validación" value={editor.validate.data} />
      ) : null}
      <OutputVariableManager variables={editor.variables} onChange={editor.changeVariables} />
      <div className="graph-workbench">
        <NodeLibrary onAddNode={editor.addNode} />
        <GraphCanvas
          nodes={editor.nodes}
          edges={editor.edges}
          selectedKey={editor.selectedKey}
          selectedEdgeKey={editor.selectedEdgeKey}
          pendingFrom={editor.pendingFrom}
          zoom={editor.zoom}
          onNodeClick={editor.handleNodeClick}
          onMoveNode={editor.moveNode}
          onDragStart={editor.beginDrag}
          onDragEnd={editor.endDrag}
          onDropNode={(type, x, y) => editor.addNode(type, { x, y })}
          onEdgeClick={editor.selectEdge}
        />
        {editor.selectedEdgeKey ? (
          <EdgeProperties
            edge={asRecord(editor.selectedEdge)}
            conditions={editor.conditions}
            onChange={editor.updateSelectedEdge}
            onDelete={() => editor.deleteEdge(editor.selectedEdgeKey)}
            onClose={editor.closeEdge}
          />
        ) : (
          <NodeProperties
            node={asRecord(editor.selected)}
            outputs={editor.outputs}
            inputs={editor.inputs}
            condition={asRecord(editor.selectedCondition)}
            onConditionChange={editor.updateSelectedCondition}
            onChange={editor.updateSelectedNode}
            onDelete={editor.deleteSelectedNode}
          />
        )}
      </div>
    </div>
  );
}
