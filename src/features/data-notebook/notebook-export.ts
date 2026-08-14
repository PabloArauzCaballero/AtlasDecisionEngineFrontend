import type { DerivedTable } from './notebook-types';

/**
 * Descargas del cuaderno: JSON y CSV.
 *
 * Se generan en el navegador a partir de lo que hay en pantalla y no se piden al servidor. No es
 * una comodidad: si la descarga la produjera el backend, tendría que volver a ejecutar la consulta
 * y podría devolver algo distinto de lo que se está mirando —otra página, otro instante, otro
 * enmascarado—. Un archivo que no coincide con la tabla de la que salió es peor que no tenerlo.
 */

/** Normaliza el resultado de una celda de JavaScript a una tabla, cuando lo parece. */
export function tableFromValue(valor: unknown): DerivedTable | undefined {
  if (!Array.isArray(valor) || valor.length === 0) return undefined;

  const filas = valor.filter(
    (fila): fila is Record<string, unknown> =>
      Boolean(fila) && typeof fila === 'object' && !Array.isArray(fila),
  );
  if (filas.length !== valor.length) return undefined;

  const columns: string[] = [];
  for (const fila of filas) {
    for (const clave of Object.keys(fila)) {
      if (!columns.includes(clave)) columns.push(clave);
    }
  }

  return { columns, rows: filas };
}

/** Convierte un valor de celda a texto plano para la tabla. */
export function cellText(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'string') return valor;
  if (typeof valor === 'number' || typeof valor === 'boolean') return String(valor);
  try {
    return JSON.stringify(valor);
  } catch {
    return String(valor);
  }
}

/**
 * Escapa un campo de CSV según RFC 4180.
 *
 * El retorno de carro cuenta tanto como el salto de línea: un valor con `\r` sin entrecomillar
 * parte la fila en dos al abrirlo en una hoja de cálculo, y el desplazamiento no se nota hasta
 * muchas filas después, cuando ya nadie relaciona el desajuste con esta función.
 */
function escapeCsv(valor: unknown): string {
  const texto = cellText(valor);
  return /[",\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

export function toCsv(tabla: DerivedTable): string {
  const cabecera = tabla.columns.map(escapeCsv).join(',');
  const filas = tabla.rows.map((fila) =>
    tabla.columns.map((columna) => escapeCsv(fila[columna])).join(','),
  );
  return [cabecera, ...filas].join('\r\n');
}

export function toJson(tabla: DerivedTable): string {
  return `${JSON.stringify(tabla.rows, null, 2)}\n`;
}

/**
 * Marca de orden de bytes de UTF-8, escrita por su punto de código y no pegada literal.
 *
 * Va delante del CSV porque Excel en Windows —que es donde se abre— interpreta un CSV sin BOM con
 * la página de códigos del sistema, y «Pérez» aparece como «PÃ©rez». Se construye por CÓDIGO
 * y no se pega literal: pegado es un carácter invisible que cualquier limpieza de espacios se
 * lleva por delante, sin que nadie note que la codificación dejó de anunciarse.
 */
const BOM = String.fromCharCode(0xfeff);

export function downloadFile(nombre: string, contenido: string, tipo: 'csv' | 'json'): void {
  const cuerpo = tipo === 'csv' ? `${BOM}${contenido}` : contenido;
  const blob = new Blob([cuerpo], {
    type: tipo === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  // Sin revocar, cada descarga deja el blob retenido mientras viva la pestaña.
  URL.revokeObjectURL(url);
}

/** `panorama-de-clientes` + fecha, para que dos descargas seguidas no se pisen en la carpeta. */
export function fileName(base: string, extension: 'csv' | 'json'): string {
  const marca = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const limpio = base
    .toLowerCase()
    // `NFD` separa la tilde de la letra y el filtro siguiente descarta la tilde suelta: sin esto,
    // «Panorámica» perdería la vocal entera en vez del acento.
    .normalize('NFD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${limpio || 'cuaderno'}-${marca}.${extension}`;
}
