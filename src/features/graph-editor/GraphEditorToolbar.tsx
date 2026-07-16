import { Link2, Redo2, Save, ShieldCheck, Undo2, ZoomIn, ZoomOut } from 'lucide-react';

interface GraphEditorToolbarProps {
  versionId: string;
  canUndo: boolean;
  canRedo: boolean;
  connectMode: boolean;
  loading: boolean;
  saving: boolean;
  validating: boolean;
  onVersionIdChange: (value: string) => void;
  onLoad: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onToggleConnect: () => void;
  onValidate: () => void;
  onSave: () => void;
}

export function GraphEditorToolbar(props: GraphEditorToolbarProps) {
  return (
    <header className="editor-toolbar">
      <div>
        <strong>Decision Graph Editor</strong>
        <span>Version ID</span>
        <input
          value={props.versionId}
          onChange={(event) => props.onVersionIdChange(event.target.value)}
          placeholder="Artifact version ID"
        />
        <button
          className="button"
          type="button"
          disabled={!props.versionId || props.loading}
          onClick={props.onLoad}
        >
          {props.loading ? 'Loading…' : 'Load'}
        </button>
      </div>
      <div>
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
          className="icon-button"
          type="button"
          title="Acercar"
          aria-label="Acercar grafo"
          onClick={props.onZoomIn}
        >
          <ZoomIn />
        </button>
        <button
          className={`icon-button ${props.connectMode ? 'active' : ''}`}
          type="button"
          title="Conectar nodos"
          aria-label="Alternar modo de conexión"
          aria-pressed={props.connectMode}
          onClick={props.onToggleConnect}
        >
          <Link2 />
        </button>
        <button
          className="button"
          type="button"
          disabled={!props.versionId || props.validating}
          onClick={props.onValidate}
        >
          <ShieldCheck size={16} /> {props.validating ? 'Validating…' : 'Validate'}
        </button>
        <button
          className="button button-primary"
          type="button"
          disabled={!props.versionId || props.saving}
          onClick={props.onSave}
        >
          <Save size={16} /> {props.saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </header>
  );
}
