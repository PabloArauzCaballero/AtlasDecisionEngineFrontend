import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { apiRequest } from '../../api/http-client';
import { snapshotToEditableGraph } from '../../graph/graph.adapter';
import { asRecord, asRows, display, type UnknownRecord } from '../../utils/records';
import { updateSiblingEdge } from './graph-edge-update';
import { createEdgeDraft, createNodeDraft, edgeCreationError } from './graph-authoring';
import { connectionErrorNotice, type ConnectionNotice } from './connection-feedback';
import { layoutGraphNodes } from './graph-layout';
import { withEdges, withNodes } from './graph-snapshot';
import { useGraphHistory } from './useGraphHistory';

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.1;

export function useGraphEditor(initialVersionId = '') {
  const [versionId, setVersionId] = useState(initialVersionId);
  const [selectedKey, setSelectedKey] = useState('');
  const [selectedEdgeKey, setSelectedEdgeKey] = useState('');
  const [lockVersion, setLockVersion] = useState('0');
  const [zoom, setZoom] = useState(1);
  const [connectMode, setConnectMode] = useState(false);
  const [pendingFrom, setPendingFrom] = useState<string | null>(null);
  const [connectionNotice, setConnectionNotice] = useState<ConnectionNotice | null>(null);
  const history = useGraphHistory();

  const nodes = asRows(history.snapshot.nodes);
  const edges = asRows(history.snapshot.edges);
  const variables = asRows(history.snapshot.variables);
  const conditions = asRows(history.snapshot.conditions);
  const outputs = variables.filter((variable) =>
    String(variable.usageType ?? '').startsWith('OUTPUT'),
  );
  const inputs = variables.filter(
    (variable) => !String(variable.usageType ?? 'INPUT').startsWith('OUTPUT'),
  );
  const selected = nodes.find((node) => display(node, 'key') === selectedKey) ?? {};
  const selectedEdge = edges.find((edge) => display(edge, 'key') === selectedEdgeKey) ?? {};
  const selectedConditionCode = String(asRecord(selected.config).conditionCode ?? '');
  const selectedCondition =
    conditions.find((condition) => display(condition, 'code') === selectedConditionCode) ?? {};

  const load = useMutation({
    mutationFn: async () => {
      const encodedVersionId = encodeURIComponent(versionId);
      return Promise.all([
        apiRequest<UnknownRecord>(`/v1/artifact-versions/${encodedVersionId}/graph`),
        apiRequest<UnknownRecord>(`/v1/artifact-versions/${encodedVersionId}`),
      ]);
    },
    onSuccess: ([graph, version]) => {
      history.reset(graph);
      setSelectedKey(display(asRows(graph.nodes)[0] ?? {}, 'key'));
      setSelectedEdgeKey('');
      setLockVersion(display(version, 'lockVersion'));
      setPendingFrom(null);
      setConnectMode(false);
      setConnectionNotice(null);
    },
  });

  const save = useMutation({
    mutationFn: () =>
      apiRequest<UnknownRecord>(`/v1/artifact-versions/${encodeURIComponent(versionId)}/graph`, {
        method: 'PUT',
        headers: { 'if-match': lockVersion },
        body: snapshotToEditableGraph(history.snapshot),
      }),
    onSuccess: (saved) => {
      if (saved.lockVersion !== undefined) setLockVersion(String(saved.lockVersion));
      history.clearHistory();
    },
  });

  const validate = useMutation({
    mutationFn: () =>
      apiRequest(`/v1/artifact-versions/${encodeURIComponent(versionId)}/validate`, {
        method: 'POST',
        body: {},
      }),
  });

  const addNode = (type: string, position?: { x: number; y: number }) => {
    if (type === 'START') {
      const existingStart = nodes.find((node) => node.type === 'START');
      if (existingStart) {
        selectNode(display(existingStart, 'key'));
        return;
      }
    }

    const draft = createNodeDraft(type, nodes, inputs, position);
    history.commit({
      ...history.snapshot,
      nodes: [...nodes, draft.node],
      conditions: draft.condition ? [...conditions, draft.condition] : conditions,
    });
    selectNode(display(draft.node, 'key'));
  };

  const moveNode = (key: string, x: number, y: number) => {
    history.setSnapshot(
      withNodes(
        history.snapshot,
        nodes.map((node) => (display(node, 'key') === key ? { ...node, x, y } : node)),
      ),
    );
  };

  const updateSelectedNode = (patch: UnknownRecord) => {
    history.commit(
      withNodes(
        history.snapshot,
        nodes.map((node) => (display(node, 'key') === selectedKey ? { ...node, ...patch } : node)),
      ),
    );
  };

  const updateConditionByCode = (code: string, patch: UnknownRecord) => {
    if (!code) return;
    history.commit({
      ...history.snapshot,
      conditions: conditions.map((condition) =>
        display(condition, 'code') === code ? { ...condition, ...patch } : condition,
      ),
    });
  };

  const updateSelectedEdge = (patch: UnknownRecord) => {
    if (!selectedEdgeKey) return;
    const current = edges.find((edge) => display(edge, 'key') === selectedEdgeKey);
    if (!current) return;

    const sourceKey = display(current, 'from');
    const siblings = edges.filter(
      (edge) => display(edge, 'from') === sourceKey && display(edge, 'key') !== selectedEdgeKey,
    );
    if (patch.default === false && current.default && !siblings.length) return;

    const source = nodes.find((node) => display(node, 'key') === sourceKey);
    const sourceConditionCode = String(asRecord(source?.config).conditionCode ?? '');
    if (patch.default === true && siblings.some((edge) => edge.default) && !sourceConditionCode) {
      return;
    }

    history.commit(
      withEdges(
        history.snapshot,
        edges.map((edge) =>
          updateSiblingEdge({
            edge,
            current,
            patch,
            selectedEdgeKey,
            sourceKey,
            sourceConditionCode,
            firstSibling: siblings[0],
          }),
        ),
      ),
    );
  };

  const deleteSelectedNode = () => {
    const remainingNodes = nodes.filter((node) => display(node, 'key') !== selectedKey);
    const remainingEdges = edges.filter(
      (edge) => display(edge, 'from') !== selectedKey && display(edge, 'to') !== selectedKey,
    );
    history.commit(withEdges(withNodes(history.snapshot, remainingNodes), remainingEdges));
    setSelectedKey('');
    setSelectedEdgeKey('');
  };

  const deleteEdge = (edgeKey: string) => {
    history.commit(
      withEdges(
        history.snapshot,
        edges.filter((edge) => display(edge, 'key') !== edgeKey),
      ),
    );
    if (selectedEdgeKey === edgeKey) setSelectedEdgeKey('');
  };

  const selectNode = (key: string) => {
    setSelectedKey(key);
    setSelectedEdgeKey('');
  };

  const selectEdge = (edgeKey: string) => {
    setSelectedEdgeKey(edgeKey);
    setSelectedKey('');
  };

  const handleNodeClick = (node: UnknownRecord) => {
    const key = display(node, 'key');
    if (!connectMode) {
      selectNode(key);
      return;
    }
    if (!pendingFrom) {
      setPendingFrom(key);
      setConnectionNotice({
        tone: 'info',
        text: `Origen seleccionado: ${display(node, 'label', 'key')}. Ahora elige el destino.`,
      });
      return;
    }
    if (pendingFrom === key) {
      setPendingFrom(null);
      setConnectionNotice({ tone: 'info', text: 'Selección de origen cancelada.' });
      return;
    }

    const error = edgeCreationError(pendingFrom, key, nodes, edges, conditions);
    const draft = createEdgeDraft(pendingFrom, key, nodes, edges, conditions);
    if (draft) {
      history.commit({
        ...withEdges(history.snapshot, [...edges, draft.edge]),
        conditions: draft.condition ? [...conditions, draft.condition] : conditions,
      });
      selectEdge(display(draft.edge, 'key'));
      setConnectionNotice({
        tone: 'success',
        text: `Conexión creada: ${pendingFrom} → ${key}.`,
      });
    } else if (error) {
      setConnectionNotice(connectionErrorNotice(error));
    }
    setPendingFrom(null);
  };

  const autoLayout = () => {
    if (!nodes.length) return;
    history.commit(withNodes(history.snapshot, layoutGraphNodes(nodes, edges)));
  };

  return {
    versionId,
    setVersionId,
    nodes,
    edges,
    variables,
    conditions,
    outputs,
    inputs,
    selected,
    selectedEdge,
    selectedCondition,
    selectedKey,
    selectedEdgeKey,
    pendingFrom,
    connectionNotice,
    zoom,
    connectMode,
    load,
    save,
    validate,
    addNode,
    moveNode,
    updateSelectedNode,
    updateSelectedCondition: (patch: UnknownRecord) =>
      updateConditionByCode(selectedConditionCode, patch),
    updateConditionByCode,
    updateSelectedEdge,
    deleteSelectedNode,
    deleteEdge,
    handleNodeClick,
    selectEdge,
    closeEdge: () => setSelectedEdgeKey(''),
    changeVariables: (nextVariables: UnknownRecord[]) =>
      history.commit({ ...history.snapshot, variables: nextVariables }),
    beginDrag: history.beginDrag,
    endDrag: history.endDrag,
    undo: history.undo,
    redo: history.redo,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    zoomOut: () => setZoom((value) => Math.max(ZOOM_MIN, +(value - ZOOM_STEP).toFixed(2))),
    zoomIn: () => setZoom((value) => Math.min(ZOOM_MAX, +(value + ZOOM_STEP).toFixed(2))),
    resetZoom: () => setZoom(1),
    autoLayout,
    cancelConnection: () => {
      setPendingFrom(null);
      setConnectionNotice({ tone: 'info', text: 'Conexión cancelada.' });
    },
    toggleConnectMode: () => {
      const next = !connectMode;
      setConnectMode(next);
      setConnectionNotice(
        next
          ? { tone: 'info', text: 'Selecciona primero el nodo de origen y luego el destino.' }
          : null,
      );
      setPendingFrom(null);
    },
  };
}
