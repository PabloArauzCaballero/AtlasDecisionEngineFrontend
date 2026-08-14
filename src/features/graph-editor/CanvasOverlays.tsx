import { Link2, Plus, X } from 'lucide-react';
import { Illustration } from '../../components/Illustration';
import type { ConnectionNotice } from './connection-feedback';

/**
 * Las tres capas que se pintan SOBRE el lienzo: la guía del modo conexión, el
 * aviso de carga y el estado vacío.
 *
 * Viven aparte de `GraphCanvas` porque ninguna toca el mundo desplazable ni el
 * arrastre: son mensajes al operador, y tenerlas dentro dejaba el componente del
 * lienzo por encima del tope de 299 líneas mezclando dos asuntos distintos.
 */

interface ConnectionGuideProps {
  pendingFrom?: string | null;
  notice?: ConnectionNotice | null;
  onCancel: () => void;
}

function ConnectionGuide({ pendingFrom, notice, onCancel }: ConnectionGuideProps) {
  return (
    <div className={`canvas-connection-guide notice-${notice?.tone ?? 'info'}`} role="status">
      <span className="canvas-connection-icon">
        <Link2 size={15} />
      </span>
      <span>
        <strong>{pendingFrom ? 'Elige el destino' : 'Modo conexión activo'}</strong>
        <small>
          {notice?.text ?? 'Selecciona primero el nodo de origen y después el nodo de destino.'}
        </small>
      </span>
      {pendingFrom ? (
        <button type="button" onClick={onCancel} aria-label="Cancelar conexión">
          <X size={14} />
        </button>
      ) : null}
    </div>
  );
}

/* Cargar un grafo tarda: sin este aviso el lienzo se queda en blanco y se lee
   como "no hay nada" o como que la aplicación falló. */
function CanvasLoading() {
  return (
    <div className="canvas-loading" role="status">
      <span className="canvas-loading-nodes" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <strong>Cargando el algoritmo…</strong>
      <p>Estamos trayendo del motor los nodos, las condiciones y las acciones de la versión.</p>
    </div>
  );
}

function CanvasEmptyState({ onAddStart }: { onAddStart: () => void }) {
  return (
    <div className="canvas-empty-state">
      <Illustration name="graph" size={132} />
      <strong>Empieza a diseñar tu algoritmo</strong>
      <p>
        Un algoritmo es un recorrido de bloques: empieza en Inicio, se bifurca según tus reglas y
        termina en un Resultado. Agrega el nodo inicial y construye de izquierda a derecha.
      </p>
      <button className="button button-primary" type="button" onClick={onAddStart}>
        <Plus size={16} /> Agregar inicio
      </button>
    </div>
  );
}

export interface CanvasOverlaysProps {
  connectMode: boolean;
  connectionNotice?: ConnectionNotice | null;
  pendingFrom?: string | null;
  loading: boolean;
  isEmpty: boolean;
  onCancelConnection: () => void;
  onAddStart: () => void;
}

export function CanvasOverlays({
  connectMode,
  connectionNotice,
  pendingFrom,
  loading,
  isEmpty,
  onCancelConnection,
  onAddStart,
}: CanvasOverlaysProps) {
  return (
    <>
      {connectMode ? (
        <ConnectionGuide
          pendingFrom={pendingFrom}
          notice={connectionNotice}
          onCancel={onCancelConnection}
        />
      ) : null}
      {loading ? <CanvasLoading /> : null}
      {!loading && isEmpty ? <CanvasEmptyState onAddStart={onAddStart} /> : null}
    </>
  );
}
