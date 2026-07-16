import { useRef, useState } from 'react';
import type { UnknownRecord } from '../../utils/records';

/**
 * Tracks graph snapshots for undo, redo and drag operations.
 */
export function useGraphHistory() {
  const [snapshot, setSnapshot] = useState<UnknownRecord>({});
  const [past, setPast] = useState<UnknownRecord[]>([]);
  const [future, setFuture] = useState<UnknownRecord[]>([]);
  const dragOrigin = useRef<UnknownRecord | null>(null);

  const commit = (next: UnknownRecord) => {
    setPast((previous) => [...previous, snapshot]);
    setFuture([]);
    setSnapshot(next);
  };

  const reset = (next: UnknownRecord) => {
    setSnapshot(next);
    setPast([]);
    setFuture([]);
    dragOrigin.current = null;
  };

  const undo = () => {
    if (!past.length) return;
    const previous = past[past.length - 1];
    setFuture((current) => [snapshot, ...current]);
    setPast((current) => current.slice(0, -1));
    setSnapshot(previous);
  };

  const redo = () => {
    if (!future.length) return;
    const next = future[0];
    setPast((current) => [...current, snapshot]);
    setFuture((current) => current.slice(1));
    setSnapshot(next);
  };

  const beginDrag = () => {
    dragOrigin.current = snapshot;
  };

  const endDrag = () => {
    if (!dragOrigin.current) return;
    setPast((current) => [...current, dragOrigin.current as UnknownRecord]);
    setFuture([]);
    dragOrigin.current = null;
  };

  const clearHistory = () => {
    setPast([]);
    setFuture([]);
  };

  return {
    snapshot,
    setSnapshot,
    commit,
    reset,
    undo,
    redo,
    beginDrag,
    endDrag,
    clearHistory,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  };
}
