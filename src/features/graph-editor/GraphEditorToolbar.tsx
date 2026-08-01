import { useQuery } from '@tanstack/react-query';
import {
  AlignHorizontalSpaceAround,
  Eye,
  EyeOff,
  Link2,
  Redo2,
  Save,
  ShieldCheck,
  Undo2,
  Workflow,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { apiRequest } from '../../api/http-client';
import { asRows, display, type UnknownRecord } from '../../utils/records';

interface GraphEditorToolbarProps {
  versionId: string;
  canUndo: boolean;
  canRedo: boolean;
  connectMode: boolean;
  zoom: number;
  loading: boolean;
  saving: boolean;
  validating: boolean;
  onVersionIdChange: (value: string) => void;
  onLoad: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onResetZoom: () => void;
  onAutoLayout: () => void;
  /** Nivel de detalle del lienzo: reglas y marcas visibles en cada nodo. */
  detailed: boolean;
  onToggleDetail: () => void;
  onToggleConnect: () => void;
  onValidate: () => void;
  onSave: () => void;
}

export function GraphEditorToolbar(props: GraphEditorToolbarProps) {
  const versions = useQuery({
    queryKey: ['picker', 'graph-editor-versions'],
    queryFn: () => apiRequest<UnknownRecord[]>('/v1/views/pickers/artifact-versions'),
    staleTime: 60_000,
  });
  const versionRows = asRows(versions.data);
  const hasCurrent =
    props.versionId === '' || versionRows.some((row) => display(row, 'id') === props.versionId);

  return (
    <header className="editor-toolbar">
      <div className="editor-toolbar-primary">
        <div className="editor-identity">
          <span className="editor-identity-icon" aria-hidden="true">
            <Workflow size={19} />
          </span>
          <div>
            <strong>Constructor manual</strong>
            <small>Algoritmo de decisión</small>
          </div>
        </div>
        <div className="editor-version-control">
          <label htmlFor="graph-version-id">Versión del artefacto</label>
          <div>
            {versions.isError ? (
              <input
                id="graph-version-id"
                value={props.versionId}
                onChange={(event) => props.onVersionIdChange(event.target.value)}
                placeholder="ID de versión"
              />
            ) : (
              <select
                id="graph-version-id"
                value={props.versionId}
                onChange={(event) => props.onVersionIdChange(event.target.value)}
              >
                <option value="">
                  {versions.isPending ? 'Cargando versiones…' : 'Elegir versión…'}
                </option>
                {!hasCurrent ? <option value={props.versionId}>{props.versionId}</option> : null}
                {versionRows.map((row) => (
                  <option key={display(row, 'id')} value={display(row, 'id')}>
                    {display(row, 'artifactCode')} v{display(row, 'semanticVersion')} ·{' '}
                    {display(row, 'status')}
                  </option>
                ))}
              </select>
            )}
            <button
              className="button"
              type="button"
              disabled={!props.versionId || props.loading}
              onClick={props.onLoad}
            >
              {props.loading ? 'Cargando…' : 'Cargar'}
            </button>
          </div>
        </div>
      </div>
      <div className="editor-toolbar-actions">
        <div className="editor-tool-group" aria-label="Historial">
          <button
            className="icon-button"
            type="button"
            title="Deshacer"
            aria-label="Deshacer"
            disabled={!props.canUndo}
            onClick={props.onUndo}
          >
            <Undo2 />
          </button>
          <button
            className="icon-button"
            type="button"
            title="Rehacer"
            aria-label="Rehacer"
            disabled={!props.canRedo}
            onClick={props.onRedo}
          >
            <Redo2 />
          </button>
        </div>
        <div className="editor-tool-group editor-zoom-group" aria-label="Escala del lienzo">
          <button
            className="icon-button"
            type="button"
            title="Alejar"
            aria-label="Alejar grafo"
            onClick={props.onZoomOut}
          >
            <ZoomOut />
          </button>
          <button
            className="zoom-value"
            type="button"
            title="Restablecer zoom"
            onClick={props.onResetZoom}
          >
            {Math.round(props.zoom * 100)}%
          </button>
          <button
            className="icon-button"
            type="button"
            title="Acercar"
            aria-label="Acercar grafo"
            onClick={props.onZoomIn}
          >
            <ZoomIn />
          </button>
        </div>
        <button
          className="button editor-layout-button"
          type="button"
          title="Ordenar automáticamente de izquierda a derecha"
          onClick={props.onAutoLayout}
        >
          <AlignHorizontalSpaceAround size={16} /> Ordenar
        </button>
        <button
          className={`button editor-detail-button ${props.detailed ? 'active' : ''}`}
          type="button"
          aria-pressed={props.detailed}
          title={
            props.detailed
              ? 'Ocultar la regla de cada nodo para ver el grafo de un vistazo'
              : 'Mostrar en cada nodo la regla que aplica y qué variables usa'
          }
          onClick={props.onToggleDetail}
        >
          {props.detailed ? <Eye size={16} /> : <EyeOff size={16} />}
          {props.detailed ? 'Detallado' : 'Compacto'}
        </button>
        <button
          className={`button editor-connect-button ${props.connectMode ? 'active' : ''}`}
          type="button"
          data-tutorial-id="graph-connect"
          title="Conectar nodos"
          aria-label="Alternar modo de conexión"
          aria-pressed={props.connectMode}
          onClick={props.onToggleConnect}
        >
          <Link2 size={16} /> {props.connectMode ? 'Conectando' : 'Conectar'}
        </button>
        <span className="editor-actions-separator" aria-hidden="true" />
        <button
          className="button"
          type="button"
          data-tutorial-id="graph-validate"
          disabled={!props.versionId || props.validating}
          onClick={props.onValidate}
        >
          <ShieldCheck size={16} /> {props.validating ? 'Validando…' : 'Validar'}
        </button>
        <button
          className="button button-primary"
          type="button"
          disabled={!props.versionId || props.saving}
          onClick={props.onSave}
        >
          <Save size={16} /> {props.saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </header>
  );
}
