import {
  Archive,
  ArrowUpFromLine,
  ChevronDown,
  ChevronUp,
  Cog,
  Copy,
  Download,
  Eye,
  FlaskConical,
  GitCompare,
  History,
  Pencil,
  Play,
  Power,
  PowerOff,
  Trash2,
  Workflow,
  type LucideIcon,
} from 'lucide-react';

export type ActionVariant = 'default' | 'primary' | 'danger';

export interface ActionConfirm {
  title: string;
  body: string;
  confirmLabel: string;
}

export interface ActionDefinition {
  icon: LucideIcon;
  /** Nombre accesible por defecto (aria-label / tooltip). Se puede especializar. */
  label: string;
  variant: ActionVariant;
  /** Permiso requerido, si aplica (para futuros gates). */
  permission?: string;
  /** Confirmación obligatoria para acciones destructivas o de alto impacto. */
  confirm?: ActionConfirm;
}

/**
 * Catálogo central de acciones: cada acción define su icono, texto accesible,
 * variante visual y, cuando corresponde, su confirmación. Evita duplicar la
 * lógica de iconos/tooltips en cada tabla y mantiene una sola verdad por acción.
 */
export const ACTIONS = {
  view: { icon: Eye, label: 'Ver detalle', variant: 'default' },
  edit: { icon: Pencil, label: 'Editar', variant: 'default' },
  duplicate: { icon: Copy, label: 'Duplicar', variant: 'default' },
  compare: { icon: GitCompare, label: 'Comparar versiones', variant: 'default' },
  graph: { icon: Workflow, label: 'Ver grafo', variant: 'default' },
  compile: { icon: Cog, label: 'Compilar versión', variant: 'default' },
  tests: { icon: FlaskConical, label: 'Ver pruebas', variant: 'default' },
  history: { icon: History, label: 'Consultar historial', variant: 'default' },
  execute: { icon: Play, label: 'Ejecutar', variant: 'primary' },
  download: { icon: Download, label: 'Descargar', variant: 'default' },
  expand: { icon: ChevronDown, label: 'Expandir', variant: 'default' },
  collapse: { icon: ChevronUp, label: 'Contraer', variant: 'default' },
  publish: {
    icon: ArrowUpFromLine,
    label: 'Publicar',
    variant: 'primary',
    confirm: {
      title: 'Publicar versión',
      body: 'La versión quedará disponible para nuevas ejecuciones. ¿Continuar?',
      confirmLabel: 'Publicar',
    },
  },
  activate: {
    icon: Power,
    label: 'Activar para nuevas ejecuciones',
    variant: 'primary',
    confirm: {
      title: 'Activar versión',
      body: 'Esta versión pasará a resolver las nuevas ejecuciones. ¿Continuar?',
      confirmLabel: 'Activar',
    },
  },
  deactivate: {
    icon: PowerOff,
    label: 'Desactivar',
    variant: 'default',
    confirm: {
      title: 'Desactivar',
      body: 'Dejará de usarse en nuevas ejecuciones. ¿Continuar?',
      confirmLabel: 'Desactivar',
    },
  },
  archive: {
    icon: Archive,
    label: 'Archivar',
    variant: 'default',
    confirm: {
      title: 'Archivar',
      body: 'Se moverá al archivo y saldrá de los listados activos. ¿Continuar?',
      confirmLabel: 'Archivar',
    },
  },
  delete: {
    icon: Trash2,
    label: 'Eliminar',
    variant: 'danger',
    confirm: {
      title: 'Eliminar definitivamente',
      body: 'Esta acción no se puede deshacer. ¿Seguro que quieres eliminarlo?',
      confirmLabel: 'Eliminar',
    },
  },
} as const satisfies Record<string, ActionDefinition>;

export type ActionKey = keyof typeof ACTIONS;
