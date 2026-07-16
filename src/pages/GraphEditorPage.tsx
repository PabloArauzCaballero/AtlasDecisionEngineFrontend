import { useMutation } from '@tanstack/react-query';
import { Link2, Redo2, Save, ShieldCheck, Undo2, ZoomIn, ZoomOut } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiRequest } from '../api/http-client';
import { errorMessage } from '../api/ApiError';
import { Alert } from '../components/Alert';
import { JsonPanel } from '../components/JsonPanel';
import { GraphCanvas } from '../features/graph-editor/GraphCanvas';
import { EdgeProperties } from '../features/graph-editor/EdgeProperties';
import { createEdgeDraft, createNodeDraft } from '../features/graph-editor/graph-authoring';
import { NodeLibrary } from '../features/graph-editor/NodeLibrary';
import { NodeProperties } from '../features/graph-editor/NodeProperties';
import { OutputVariableManager } from '../features/graph-editor/OutputVariableManager';
import { snapshotToEditableGraph } from '../graph/graph.adapter';
import { asRecord, asRows, display, type UnknownRecord } from '../utils/records';

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.1;

function withNodes(snapshot: UnknownRecord, nodes: UnknownRecord[]): UnknownRecord {
  return { ...snapshot, nodes };
}

function withEdges(snapshot: UnknownRecord, edges: UnknownRecord[]): UnknownRecord {
  return { ...snapshot, edges };
}

export function GraphEditorPage() {
  const params = useParams();
  const [versionId, setVersionId] = useState(params.versionId ?? '');
  const [snapshot, setSnapshot] = useState<UnknownRecord>({});
  const [selectedKey, setSelectedKey] = useState('');
  const [selectedEdgeKey, setSelectedEdgeKey] = useState('');
  const [lockVersion, setLockVersion] = useState('0');
  const [zoom, setZoom] = useState(1);
  const [connectMode, setConnectMode] = useState(false);
  const [pendingFrom, setPendingFrom] = useState<string | null>(null);
  const [past, setPast] = useState<UnknownRecord[]>([]);
  const [future, setFuture] = useState<UnknownRecord[]>([]);
  const dragOrigin = useRef<UnknownRecord | null>(null);

  const nodes = asRows(snapshot.nodes);
  const edges = asRows(snapshot.edges);
  const variables = asRows(snapshot.variables);
  const conditions = asRows(snapshot.conditions);
  const outputs = variables.filter((variable) =>
    String(variable.usageType ?? '').startsWith('OUTPUT'),
  );
  const inputs = variables.filter(
    (variable) => !String(variable.usageType ?? 'INPUT').startsWith('OUTPUT'),
  );
  const selected = useMemo(
    () => nodes.find((node) => display(node, 'key') === selectedKey) ?? {},
    [nodes, selectedKey],
  );
  const selectedEdge = useMemo(
    () => edges.find((edge) => display(edge, 'key') === selectedEdgeKey) ?? {},
    [edges, selectedEdgeKey],
  );
  const selectedConditionCode = String(asRecord(selected.config).conditionCode ?? '');
  const selectedCondition =
    conditions.find((condition) => display(condition, 'code') === selectedConditionCode) ?? {};

  function commit(next: UnknownRecord) {
    setPast((prev) => [...prev, snapshot]);
    setFuture([]);
    setSnapshot(next);
  }

  function undo() {
    if (!past.length) return;
    const previous = past[past.length - 1];
    setFuture((prev) => [snapshot, ...prev]);
    setPast((prev) => prev.slice(0, -1));
    setSnapshot(previous);
  }

  function redo() {
    if (!future.length) return;
    const next = future[0];
    setPast((prev) => [...prev, snapshot]);
    setFuture((prev) => prev.slice(1));
    setSnapshot(next);
  }

  const load = useMutation({
    mutationFn: async () =>
      Promise.all([
        apiRequest<UnknownRecord>(`/v1/artifact-versions/${versionId}/graph`),
        apiRequest<UnknownRecord>(`/v1/artifact-versions/${versionId}`),
      ]),
    onSuccess: ([graph, version]) => {
      setSnapshot(graph);
      setSelectedKey(display(asRows(graph.nodes)[0] ?? {}, 'key'));
      setSelectedEdgeKey('');
      setLockVersion(display(version, 'lockVersion'));
      setPast([]);
      setFuture([]);
      setPendingFrom(null);
      setConnectMode(false);
    },
  });

  const save = useMutation({
    mutationFn: () =>
      apiRequest<UnknownRecord>(`/v1/artifact-versions/${versionId}/graph`, {
        method: 'PUT',
        headers: { 'if-match': lockVersion },
        body: snapshotToEditableGraph(snapshot),
      }),
    onSuccess: (saved) => {
      if (saved.lockVersion !== undefined) setLockVersion(String(saved.lockVersion));
      setPast([]);
      setFuture([]);
    },
  });

  const validate = useMutation({
    mutationFn: () =>
      apiRequest(`/v1/artifact-versions/${versionId}/validate`, { method: 'POST', body: {} }),
  });

  function addNode(type: string, position?: { x: number; y: number }) {
    if (type === 'START') {
      const existingStart = nodes.find((node) => node.type === 'START');
      if (existingStart) {
        setSelectedKey(display(existingStart, 'key'));
        setSelectedEdgeKey('');
        return;
      }
    }
    const draft = createNodeDraft(type, nodes, inputs, position);
    commit({
      ...snapshot,
      nodes: [...nodes, draft.node],
      conditions: draft.condition ? [...conditions, draft.condition] : conditions,
    });
    setSelectedKey(display(draft.node, 'key'));
    setSelectedEdgeKey('');
  }

  function beginDrag() {
    dragOrigin.current = snapshot;
  }

  function endDrag() {
    if (dragOrigin.current) {
      setPast((prev) => [...prev, dragOrigin.current as UnknownRecord]);
      setFuture([]);
      dragOrigin.current = null;
    }
  }

  function moveNode(key: string, x: number, y: number) {
    setSnapshot(
      withNodes(
        snapshot,
        nodes.map((node) => (display(node, 'key') === key ? { ...node, x, y } : node)),
      ),
    );
  }

  function updateSelectedNode(patch: UnknownRecord) {
    commit(
      withNodes(
        snapshot,
        nodes.map((node) => (display(node, 'key') === selectedKey ? { ...node, ...patch } : node)),
      ),
    );
  }

  function updateSelectedCondition(patch: UnknownRecord) {
    if (!selectedConditionCode) return;
    commit({
      ...snapshot,
      conditions: conditions.map((condition) =>
        display(condition, 'code') === selectedConditionCode
          ? { ...condition, ...patch }
          : condition,
      ),
    });
  }

  function updateSelectedEdge(patch: UnknownRecord) {
    if (!selectedEdgeKey) return;
    const current = edges.find((edge) => display(edge, 'key') === selectedEdgeKey);
    if (!current) return;
    const siblings = edges.filter(
      (edge) =>
        display(edge, 'from') === display(current, 'from') &&
        display(edge, 'key') !== selectedEdgeKey,
    );
    if (patch.default === false && current.default && !siblings.length) return;

    const source = nodes.find((node) => display(node, 'key') === display(current, 'from'));
    const sourceConditionCode = String(asRecord(source?.config).conditionCode ?? '');
    if (patch.default === true && siblings.some((edge) => edge.default) && !sourceConditionCode) {
      return;
    }
    commit(
      withEdges(
        snapshot,
        edges.map((edge) => {
          if (display(edge, 'key') === selectedEdgeKey) return { ...edge, ...patch };
          if (display(edge, 'from') !== display(current, 'from') || patch.default === undefined) {
            return edge;
          }
          if (patch.default === true && edge.default && sourceConditionCode) {
            return {
              ...edge,
              type: 'CONDITIONAL',
              default: false,
              conditions: [{ code: sourceConditionCode, order: 1 }],
            };
          }
          if (patch.default === false && current.default && edge === siblings[0]) {
            return { ...edge, type: 'DEFAULT', default: true, conditions: [] };
          }
          return edge;
        }),
      ),
    );
  }

  function deleteSelectedNode() {
    const remaining = nodes.filter((node) => display(node, 'key') !== selectedKey);
    const remainingEdges = edges.filter(
      (edge) => display(edge, 'from') !== selectedKey && display(edge, 'to') !== selectedKey,
    );
    commit(withEdges(withNodes(snapshot, remaining), remainingEdges));
    setSelectedKey('');
    setSelectedEdgeKey('');
  }

  function deleteEdge(edgeKey: string) {
    commit(
      withEdges(
        snapshot,
        edges.filter((edge) => display(edge, 'key') !== edgeKey),
      ),
    );
    if (selectedEdgeKey === edgeKey) setSelectedEdgeKey('');
  }

  function handleNodeClick(node: UnknownRecord) {
    const key = display(node, 'key');
    if (!connectMode) {
      setSelectedKey(key);
      setSelectedEdgeKey('');
      return;
    }
    if (!pendingFrom) {
      setPendingFrom(key);
      return;
    }
    if (pendingFrom === key) {
      setPendingFrom(null);
      return;
    }
    const edge = createEdgeDraft(pendingFrom, key, nodes, edges, conditions);
    if (edge) {
      commit(withEdges(snapshot, [...edges, edge]));
      setSelectedEdgeKey(display(edge, 'key'));
      setSelectedKey('');
    }
    setPendingFrom(null);
  }

  return (
    <div className="graph-editor-page">
      <header className="editor-toolbar">
        <div>
          <strong>Decision Graph Editor</strong>
          <span>Version ID</span>
          <input
            value={versionId}
            onChange={(event) => setVersionId(event.target.value)}
            placeholder="Artifact version ID"
          />
          <button
            className="button"
            type="button"
            disabled={!versionId || load.isPending}
            onClick={() => load.mutate()}
          >
            Load
          </button>
        </div>
        <div>
          <button
            className="icon-button"
            type="button"
            title="Deshacer"
            disabled={!past.length}
            onClick={undo}
          >
            <Undo2 />
          </button>
          <button
            className="icon-button"
            type="button"
            title="Rehacer"
            disabled={!future.length}
            onClick={redo}
          >
            <Redo2 />
          </button>
          <button
            className="icon-button"
            type="button"
            title="Alejar"
            onClick={() => setZoom((z) => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)))}
          >
            <ZoomOut />
          </button>
          <button
            className="icon-button"
            type="button"
            title="Acercar"
            onClick={() => setZoom((z) => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)))}
          >
            <ZoomIn />
          </button>
          <button
            className={`icon-button ${connectMode ? 'active' : ''}`}
            type="button"
            title="Conectar nodos"
            onClick={() => {
              setConnectMode((value) => !value);
              setPendingFrom(null);
            }}
          >
            <Link2 />
          </button>
          <button
            className="button"
            type="button"
            disabled={!versionId || validate.isPending}
            onClick={() => validate.mutate()}
          >
            <ShieldCheck size={16} /> Validate
          </button>
          <button
            className="button button-primary"
            type="button"
            disabled={!versionId || save.isPending}
            onClick={() => save.mutate()}
          >
            <Save size={16} /> Save Changes
          </button>
        </div>
      </header>
      {load.isError || save.isError || validate.isError ? (
        <Alert tone="error">{errorMessage(load.error ?? save.error ?? validate.error)}</Alert>
      ) : null}
      {save.isSuccess ? <Alert tone="success">Cambios guardados.</Alert> : null}
      {validate.isSuccess ? (
        <JsonPanel label="Resultado de validación" value={validate.data} />
      ) : null}
      <OutputVariableManager
        variables={variables}
        onChange={(nextVariables) => commit({ ...snapshot, variables: nextVariables })}
      />
      <div className="graph-workbench">
        <NodeLibrary onAddNode={(type) => addNode(type)} />
        <GraphCanvas
          nodes={nodes}
          edges={edges}
          selectedKey={selectedKey}
          selectedEdgeKey={selectedEdgeKey}
          pendingFrom={pendingFrom}
          zoom={zoom}
          onNodeClick={handleNodeClick}
          onMoveNode={moveNode}
          onDragStart={beginDrag}
          onDragEnd={endDrag}
          onDropNode={(type, x, y) => addNode(type, { x, y })}
          onEdgeClick={(edgeKey) => {
            setSelectedEdgeKey(edgeKey);
            setSelectedKey('');
          }}
        />
        {selectedEdgeKey ? (
          <EdgeProperties
            edge={asRecord(selectedEdge)}
            conditions={conditions}
            onChange={updateSelectedEdge}
            onDelete={() => deleteEdge(selectedEdgeKey)}
            onClose={() => setSelectedEdgeKey('')}
          />
        ) : (
          <NodeProperties
            node={asRecord(selected)}
            outputs={outputs}
            inputs={inputs}
            condition={asRecord(selectedCondition)}
            onConditionChange={updateSelectedCondition}
            onChange={updateSelectedNode}
            onDelete={deleteSelectedNode}
          />
        )}
      </div>
    </div>
  );
}
