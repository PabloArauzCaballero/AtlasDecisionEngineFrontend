import {
  AudioLines,
  FileSpreadsheet,
  FileText,
  ScanFace,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { GENERADOR_DOCUMENTAL, type TabCode } from './worker-views';

/**
 * Qué workers hay, cómo se llaman y por dónde se entra a cada uno.
 *
 * Vivía dentro de `WorkersPage`, que era su único lector mientras la elección
 * de worker se hacía con una fila de pestañas dentro de la propia página. Ahora
 * esa elección la hace el MENÚ LATERAL —un desplegable con los cinco— y la
 * página sólo muestra el que la ruta nombró, así que los dos necesitan la misma
 * lista. Duplicarla significaría que añadir un worker exige acordarse de dos
 * sitios, y el que se olvidara dejaría una entrada de menú sin página o una
 * página sin entrada.
 */

export interface WorkerMenuEntry {
  code: TabCode;
  /** El nombre completo: título de la página y etiqueta larga. */
  label: string;
  /**
   * El nombre corto, sólo para el raíl de 280 px.
   *
   * «Verificación de Identidad» ocupa tres líneas en un submenú indentado y
   * convierte una lista de cinco en un párrafo. El nombre largo sigue siendo el
   * de la página: aquí sólo se elige, allí se lee.
   */
  short: string;
  path: string;
  icon: LucideIcon;
  /** Qué hace, en una línea, mientras el catálogo del motor no responde. */
  fallbackDescription: string;
  hint: string;
}

export const WORKER_MENU: readonly WorkerMenuEntry[] = [
  {
    code: 'semantic-analysis',
    label: 'Análisis Semántico',
    short: 'Análisis semántico',
    path: '/workers/semantic-analysis',
    icon: Sparkles,
    fallbackDescription:
      'Clasifica un texto libre contra el catálogo de categorías, resolviendo entidades, montos y fechas.',
    hint: 'Sirve para saber de qué trata un texto —un reclamo, una glosa, una nota— según las categorías que tu equipo definió, con la evidencia que sostiene cada decisión.',
  },
  {
    code: 'bank-statement',
    label: 'Extractos Bancarios',
    short: 'Extractos bancarios',
    path: '/workers/bank-statement',
    icon: FileSpreadsheet,
    fallbackDescription:
      'Convierte un extracto bancario boliviano en PDF a movimientos normalizados, con su nivel de confianza.',
    hint: 'Sube el PDF de un extracto y obtén sus movimientos en una tabla que puedes descargar. El número de cuenta se publica siempre enmascarado y el documento no se conserva.',
  },
  {
    code: 'identity-verification',
    label: 'Verificación de Identidad',
    short: 'Identidad',
    path: '/workers/identity-verification',
    icon: ScanFace,
    fallbackDescription:
      'Compara la foto de un documento de identidad con una selfie y decide si son la misma persona.',
    hint: 'Sube la foto del documento y una selfie: obtienes el veredicto, los datos leídos del documento —con el número enmascarado— y la evidencia que lo sostiene. Las imágenes no se conservan.',
  },
  {
    code: 'audio-tts',
    label: 'Locución',
    short: 'Locución',
    path: '/workers/audio-tts',
    icon: AudioLines,
    fallbackDescription:
      'Convierte en voz una plantilla del catálogo, rellenando sus variables. Una frase ya locutada con la misma voz se sirve de caché.',
    hint: 'Elige qué debe decirse y con qué valores: obtienes el audio, la voz con la que se dijo y si costó generarlo o ya estaba. El texto locutado se guarda cifrado y no se publica.',
  },
  {
    code: GENERADOR_DOCUMENTAL,
    label: 'Documentos PDF',
    short: 'Documentos PDF',
    path: '/workers/pdf-generator',
    icon: FileText,
    fallbackDescription:
      'Genera un PDF maquetado a partir de una plantilla del catálogo y los datos que declara su contrato.',
    hint: 'Entregas datos estructurados y recibes el documento con el membrete, el pie y la numeración puestos. Los campos que pide cada documento los publica el propio motor: esta pantalla no los conoce de antemano.',
  },
];

export function workerMenuEntry(code: TabCode | undefined): WorkerMenuEntry {
  return WORKER_MENU.find((entry) => entry.code === code) ?? WORKER_MENU[0];
}
