/**
 * La ejecución de una transacción, como payload de `generic-result-report`.
 *
 * El generador documental ya existía y ya sabía maquetar «un título y unas secciones»; lo que
 * faltaba era que la pantalla de auditoría pudiera encargarle SU documento. Esto es esa traducción
 * y nada más: no pide datos —recibe la ejecución que la pantalla ya tiene— ni decide maquetación.
 *
 * Dos reglas que no son negociables aquí:
 *
 *  1. **Lo que la pantalla enmascara, el PDF lo enmascara.** Un informe descargable es la copia
 *     más fácil de reenviar por correo que existe en el portal: si el detalle de ejecución oculta
 *     el ingreso o el documento del solicitante y el PDF los imprime en claro, el enmascarado deja
 *     de proteger nada. Se usa el MISMO `maskValue` que la tabla.
 *  2. **Los topes del contrato se respetan al construir, no al fallar.** El esquema del template
 *     acota secciones, filas y longitudes; recortar aquí produce un documento correcto en vez de
 *     un 422 con el que el usuario no puede hacer nada.
 */

import { asRecord, asRows, display, type UnknownRecord } from '../../utils/records';
import { maskValue, sensitiveCodesOfExecution } from '../../utils/sensitivity';

/** Topes del contrato `generic-result-report@1.0.0`. */
const MAX_FILAS_TABLA = 2_000;
const MAX_LARGO_CELDA = 2_000;
const MAX_LARGO_TITULO = 160;
const MAX_LARGO_SUBTITULO = 240;

type Celda = string | number | boolean | null;

interface Campo {
  label: string;
  value: Celda;
}

interface Tabla {
  columns: Array<{ key: string; label: string }>;
  rows: Array<Record<string, Celda>>;
}

interface Seccion {
  title: string;
  description?: string;
  pageBreakBefore?: boolean;
  fields?: Campo[];
  table?: Tabla;
}

export interface ExecutionReportPayload {
  title: string;
  subtitle?: string;
  generatedAt?: string;
  summary?: Array<{ label: string; value: Celda; caption?: string }>;
  notices?: Array<{ level: 'positive' | 'caution' | 'critical'; title?: string; text: string }>;
  sections: Seccion[];
}

const recortar = (value: string, max: number): string =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;

const celda = (value: unknown): Celda => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  const texto = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return recortar(texto, MAX_LARGO_CELDA);
};

/** `—` es lo que `display` devuelve cuando no hay dato: en el PDF se prefiere el hueco vacío. */
const campo = (label: string, value: string): Campo => ({
  label,
  value: value === '—' ? null : recortar(value, MAX_LARGO_CELDA),
});

/**
 * Nombre de archivo estable y legible: el identificador de petición es lo que se cita al
 * reclamar una decisión, así que es lo que tiene que llevar el archivo en el disco.
 */
export function executionReportFileName(execution: UnknownRecord): string {
  const referencia = display(execution, 'requestId', 'executionId', 'id');
  // Mismo saneado que el nombre propuesto por el servidor en `api/file-download.ts`: sin
  // separadores de ruta y sin `..`, para que el nombre no signifique nada distinto de un nombre.
  const limpio = referencia
    .replace(/[^A-Za-z0-9._-]/g, '-')
    .replaceAll('..', '')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+/, '')
    .slice(0, 80);
  return `ejecucion-${limpio === '—' || !limpio ? 'sin-referencia' : limpio}.pdf`;
}

export function buildExecutionReport(
  execution: UnknownRecord,
  options: { generatedAt?: string } = {},
): ExecutionReportPayload {
  const variables = asRows(execution.variables);
  const traza = asRows(execution.traceSteps ?? execution.trace);
  const sensibles = sensitiveCodesOfExecution(execution);

  const estado = display(execution, 'status');
  const desenlace = display(execution, 'outcome');
  const duracion = display(execution, 'durationMs');

  const secciones: Seccion[] = [
    {
      title: 'Metadatos de contexto',
      description: 'Instantánea inmutable de la petición tal y como se ejecutó.',
      fields: [
        campo('ID de petición', display(execution, 'requestId')),
        campo('Artefacto', display(execution, 'artifactCode')),
        campo('Versión', display(execution, 'versionNumber', 'semanticVersion')),
        campo('Ambiente', display(execution, 'environmentCode')),
        campo('Principal', display(execution, 'principalId')),
        campo('Ejecutada', display(execution, 'createdAt')),
      ],
    },
  ];

  if (variables.length) {
    secciones.push({
      title: 'Variables resueltas',
      description: `${variables.length} variables con su valor final y el resolutor que lo produjo.`,
      table: {
        columns: [
          { key: 'variable', label: 'Variable' },
          { key: 'valor', label: 'Valor final' },
          { key: 'origen', label: 'Origen (resolutor)' },
        ],
        rows: variables.slice(0, MAX_FILAS_TABLA).map((item) => ({
          variable: celda(display(item, 'variableCode', 'name')),
          // El mismo enmascarado que la tabla de la pantalla, variable a variable.
          valor: celda(maskValue(item.valueJson ?? item.value, item.sensitivityClass)),
          origen: celda(display(item, 'sourceType', 'source')),
        })),
      },
    });
  }

  if (traza.length) {
    secciones.push({
      title: 'Línea de tiempo de la ejecución',
      description: `${traza.length} pasos trazados, en orden de evaluación.`,
      table: {
        columns: [
          { key: 'paso', label: '#' },
          { key: 'nodo', label: 'Nodo' },
          { key: 'detalle', label: 'Rama / evaluación' },
          { key: 'duracion', label: 'Duración (μs)' },
        ],
        rows: traza.slice(0, MAX_FILAS_TABLA).map((item, indice) => ({
          paso: indice + 1,
          nodo: celda(display(item, 'nodeKey', 'nodeType')),
          detalle: celda(display(item, 'branchTaken', 'evaluation')),
          duracion: celda(display(item, 'durationUs')),
        })),
      },
    });
  }

  const avisos: ExecutionReportPayload['notices'] = [];
  if (sensibles.size) {
    avisos.push({
      level: 'caution',
      title: 'Datos personales enmascarados',
      text:
        `Este informe oculta ${sensibles.size} ` +
        `${sensibles.size === 1 ? 'variable clasificada' : 'variables clasificadas'} como dato ` +
        'personal, igual que la pantalla de la que sale. El valor en claro no se exporta a un ' +
        'archivo descargable.',
    });
  }
  if (/FAIL|ERROR|REJECT/i.test(`${estado} ${desenlace}`)) {
    avisos.push({
      level: 'critical',
      title: 'La decisión no terminó en aprobación',
      text: `Desenlace registrado: ${desenlace === '—' ? estado : desenlace}.`,
    });
  }

  const resumen: ExecutionReportPayload['summary'] = [
    { label: 'Desenlace', value: desenlace === '—' ? estado : desenlace },
    { label: 'Estado', value: estado },
    { label: 'Duración', value: duracion === '—' ? null : `${duracion} ms` },
    { label: 'Pasos trazados', value: traza.length },
  ];

  const referencia = display(execution, 'requestId');
  const artefacto = display(execution, 'artifactCode');

  return {
    title: recortar('Ejecución de la transacción', MAX_LARGO_TITULO),
    subtitle: recortar(
      [referencia, artefacto].filter((parte) => parte && parte !== '—').join(' · ') ||
        'Detalle de auditoría',
      MAX_LARGO_SUBTITULO,
    ),
    ...(options.generatedAt ? { generatedAt: options.generatedAt } : {}),
    summary: resumen,
    ...(avisos.length ? { notices: avisos } : {}),
    sections: secciones,
  };
}

/** Reexport de conveniencia: la pantalla trabaja con `unknown` venido de la consulta. */
export const executionRecord = asRecord;
