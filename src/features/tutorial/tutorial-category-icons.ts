import {
  BookOpen,
  FileSearch,
  FlaskConical,
  LifeBuoy,
  PlayCircle,
  ShieldCheck,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import type { TutorialCategory } from './interactive-types';

/**
 * Un icono por módulo del Centro.
 *
 * Es lo que deja reconocer un grupo sin leer su rótulo cuando la lista ya pasó de cuarenta
 * recorridos. Se repite en el índice de módulos y en la cabecera de cada grupo: ver el mismo
 * dibujo en los dos sitios es lo que dice que el salto llevó a donde se pulsó.
 */
export const TUTORIAL_CATEGORY_ICONS: Readonly<Record<TutorialCategory, LucideIcon>> = {
  introduccion: BookOpen,
  diseno: Workflow,
  calidad: FlaskConical,
  gobierno: ShieldCheck,
  operacion: PlayCircle,
  auditoria: FileSearch,
  errores: LifeBuoy,
};

/** Ancla de la sección de un módulo, compartida por el índice y la propia sección. */
export const tutorialGroupAnchor = (category: TutorialCategory) => `tutoriales-${category}`;
