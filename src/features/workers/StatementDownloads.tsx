'use client';

import { saveBlob } from '../../utils/download';
import { statementToCsv, statementToJson } from './statement-export';
import type { VeredictoCategoria } from './useStatementCategories';
import type { StatementFormat } from './workers.api';

/**
 * Las descargas de un extracto convertido, de sus DOS orígenes.
 *
 * Los tres primeros archivos los sirve el motor y son la fuente canónica de lo
 * que él produjo. Los dos últimos los arma el navegador porque llevan algo que
 * el motor no tiene: las categorías. Clasificar es un paso posterior que
 * encadena el portal —N ejecuciones del worker semántico— y su resultado nunca
 * vuelve a la ejecución del extracto, así que pedirle al motor un CSV «con
 * categorías» sería pedirle un dato que no existe de su lado.
 *
 * Van juntos y rotulados aparte para que quede claro cuál trae qué: descargar
 * el CSV del motor esperando la columna de categoría y no encontrarla es
 * exactamente el desconcierto que esta separación evita.
 */

const DEL_MOTOR: ReadonlyArray<{ format: StatementFormat; label: string }> = [
  { format: 'csv', label: 'CSV' },
  { format: 'json', label: 'Movimientos (JSON)' },
  { format: 'normalized', label: 'Contrato completo' },
];

export interface StatementDownloadsProps {
  /** Resultado de la conversión, tal como lo devolvió el motor. */
  result: unknown;
  veredictos: Record<string, VeredictoCategoria>;
  /** Cuántas glosas se clasificaron. Con cero, no se ofrece lo que no hay. */
  clasificadas: number;
  descargando: boolean;
  onDescargarDelMotor: (format: StatementFormat) => void;
}

export function StatementDownloads({
  result,
  veredictos,
  clasificadas,
  descargando,
  onDescargarDelMotor,
}: StatementDownloadsProps) {
  const descargarTexto = (nombre: string, contenido: string, tipo: string) =>
    saveBlob(nombre, new Blob([contenido], { type: tipo }));

  return (
    <>
      {/*
       * Botones y no enlaces: un `<a href="/v1/…">` es una navegación del
       * navegador y ahí no viaja el token de la sesión, que esta aplicación
       * guarda en memoria. Los tres devolvían 401 y el usuario se llevaba el
       * error como archivo. El nombre lo sigue decidiendo el servidor por
       * `Content-Disposition`.
       */}
      {DEL_MOTOR.map(({ format, label }) => (
        <button
          key={format}
          type="button"
          className="button"
          disabled={descargando}
          onClick={() => onDescargarDelMotor(format)}
        >
          {label}
        </button>
      ))}

      {clasificadas > 0 ? (
        <>
          <button
            type="button"
            className="button"
            onClick={() =>
              descargarTexto(
                'movimientos-con-categorias.csv',
                statementToCsv(result, veredictos),
                'text/csv;charset=utf-8',
              )
            }
          >
            CSV con categorías
          </button>
          <button
            type="button"
            className="button"
            onClick={() =>
              descargarTexto(
                'movimientos-con-categorias.json',
                statementToJson(result, veredictos),
                'application/json;charset=utf-8',
              )
            }
          >
            JSON con categorías
          </button>
        </>
      ) : null}
    </>
  );
}
