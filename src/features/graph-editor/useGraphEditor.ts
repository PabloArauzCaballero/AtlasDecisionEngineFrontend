import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { apiRequest } from '../../api/http-client';
import { snapshotToEditableGraph } from '../../graph/graph.adapter';
import { asRecord, asRows, display, type UnknownRecord } from '../../utils/records';
import { useCanvasZoom } from '../graph-view/useCanvasZoom';
import { positionOf, worldSize } from './canvas-world';
import { createEdgeDraft, createNodeDraft, edgeCreationError } from './graph-authoring';
import { applyEdgePatch } from './edge-patch';
import { connectionErrorNotice, type ConnectionNotice } from './connection-feedback';
import { layoutGraphNodes, normalizeLoadedGraph } from './graph-layout';
import { withEdges, withNewNodeCondition, withNodes, withoutNode } from './graph-snapshot';
import { useGraphHistory } from './useGraphHistory';

export function useGraphEditor(initialVersionId = '') {
  const [versionId, setVersionId] = useState(initialVersionId);
  const [selectedKey, setSelectedKey] = useState('');
  const [selectedEdgeKey, setSelectedEdgeKey] = useState('');
  const [lockVersion, setLockVersion] = useState('0');
  const [connectMode, setConnectMode] = useState(false);
  const [pendingFrom, setPendingFrom] = useState<string | null>(null);
  const [connectionNotice, setConnectionNotice] = useState<ConnectionNotice | null>(null);
  const history = useGraphHistory();

  const nodes = asRows(history.snapshot.nodes);
  const edges = asRows(history.snapshot.edges);
  const variables = asRows(history.snapshot.variables);
  /** Variables INTERMEDIAS del grafo (§2): viven solo dentro de una ejecución. */
  const intermediates = asRows(history.snapshot.intermediates);
  /** Contrato de salida explícito (§4): de dónde sale cada campo publicado. */
  const outputContract = asRows(history.snapshot.outputContract);
  // Misma escala compartida por el resto de grafos del portal: Ctrl + rueda anclado al
  // puntero, «Ajustar» y arrastre del fondo. El mundo se declara para que «Ajustar»
  // calcule la escala exacta, igual que hace el lienzo al reservar su sitio.
  const zoom = useCanvasZoom({
    content: worldSize(
      asRows(history.snapshot.nodes).map((node, index) => positionOf(node, index)),
    ),
  });
  const conditions = asRows(history.snapshot.conditions);
  /** Catálogo de acciones: dice qué EJECUTA un nodo de acción, no sólo su tipo. */
  const actions = asRows(history.snapshot.actions);
  const isOutput = (variable: UnknownRecord) =>
    String(variable.usageType ?? 'INPUT').startsWith('OUTPUT');
  const outputs = variables.filter(isOutput);
  const inputs = variables.filter((variable) => !isOutput(variable));
  const selected = nodes.find((node) => display(node, 'key') === selectedKey) ?? {};
  const selectedEdge = edges.find((edge) => display(edge, 'key') === selectedEdgeKey) ?? {};
  const selectedConditionCode = String(asRecord(selected.config).conditionCode ?? '');
  const selectedCondition =
    conditions.find((condition) => display(condition, 'code') === selectedConditionCode) ?? {};
  // `handled`: el propio editor muestra estos fallos en su diálogo, con acceso al
  // tutorial que enseña a corregirlos, así que el aviso global sobra (ver
  // QueryProvider). Sin esto el mismo error aparecía por duplicado.
  const load = useMutation({
    meta: { handled: true },
    mutationFn: async (targetVersionId?: string) => {
      const encodedVersionId = encodeURIComponent(targetVersionId ?? versionId);
      return Promise.all([
        apiRequest<UnknownRecord>(`/v1/artifact-versions/${encodedVersionId}/graph`),
        apiRequest<UnknownRecord>(`/v1/artifact-versions/${encodedVersionId}`),
      ]);
    },
    onSuccess: ([graph, version]) => {
      const normalized = normalizeLoadedGraph(graph);
      history.reset(normalized);
      setSelectedKey(display(asRows(normalized.nodes)[0] ?? {}, 'key'));
      setSelectedEdgeKey('');
      setLockVersion(display(version, 'lockVersion'));
      setPendingFrom(null);
      setConnectMode(false);
      setConnectionNotice(null);
    },
  });
  const save = useMutation({
    meta: { handled: true },
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
    const next = applyEdgePatch({
      snapshot: history.snapshot,
      nodes,
      edges,
      selectedEdgeKey,
      patch,
    });
    if (next) history.commit(next);
  };

  const deleteSelectedNode = () => {
    // `withoutNode` se lleva también la condición que sólo usaba este nodo y
    // desengancha el campo del contrato que salía de él: si no, viajan al
    // backend en el siguiente guardado y la versión archivada describe un grafo
    // que ya no existe.
    history.commit(withoutNode(history.snapshot, selectedKey));
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
    intermediates,
    outputContract,
    conditions,
    actions,
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
    createSelectedNodeCondition: (variableCode: string) =>
      selectedKey &&
      history.commit(withNewNodeCondition(history.snapshot, selectedKey, variableCode)),
    updateSelectedEdge,
    deleteSelectedNode,
    deleteEdge,
    handleNodeClick,
    selectNode,
    selectEdge,
    closeEdge: () => setSelectedEdgeKey(''),
    changeVariables: (nextVariables: UnknownRecord[]) =>
      history.commit({ ...history.snapshot, variables: nextVariables }),
    changeIntermediates: (next: UnknownRecord[]) =>
      history.commit({ ...history.snapshot, intermediates: next }),
    changeOutputContract: (next: UnknownRecord[]) =>
      history.commit({ ...history.snapshot, outputContract: next }),
    changeActions: (nextActions: UnknownRecord[]) =>
      history.commit({ ...history.snapshot, actions: nextActions }),
    beginDrag: history.beginDrag,
    endDrag: history.endDrag,
    undo: history.undo,
    redo: history.redo,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    autoLayout,
    cancelConnection: () => {
      setPendingFrom(null);
      setConnectionNotice({ tone: 'info', text: 'Conexión cancelada.' });
    },
    toggleConnectMode: () => {
      const next = !connectMode;
      setConnectMode(next);
      const text = 'Selecciona primero el nodo de origen y luego el destino.';
      setConnectionNotice(next ? { tone: 'info', text } : null);
      setPendingFrom(null);
    },
  };
}
