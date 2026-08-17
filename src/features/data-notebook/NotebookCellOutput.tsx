'use client';

import { Download, History } from 'lucide-react';
import { exportFilename, saveBlob } from '../../utils/download';
import type { NotebookColumn } from './notebook.api';
import { tableFromValue } from './notebook-export';
import type { CellOutcome, NotebookLanguage } from './notebook-types';
import { ResultTable } from './ResultTable';

/**
 * Lo que una celda dejó: registro, error, gráficos, tabla o valor.
 *
 * Vive aparte de `NotebookCellView` por el tope de 299 líneas del repositorio, y el corte cae
 * donde ya había una costura: arriba está la celda como CONTROL —editar, mover, ejecutar— y aquí
 * la celda como RESULTADO. Son las dos cosas que cambian por motivos distintos.
 */

/**
 * Guarda el PNG que produjo la celda.
 *
 * El `data:` se decodifica A MANO. Pasarlo por el cliente HTTP del navegador habría sido más corto
 * y es lo primero que sale, pero el gate del repositorio reserva esa llamada al cliente autorizado
 * —y con razón: la excepción se pide para un caso inofensivo y luego queda abierta para el
 * siguiente, que ya no lo es—. Aquí no hay red que valga: los bytes ya están en memoria.
 *
 * El `Blob` se pasa por `saveBlob`, que es el único sitio del portal que crea y revoca el enlace
 * de descarga; revocar es justo lo que se olvida cuando alguien lo reimplementa.
 */
function descargarFigura(dataUrl: string, celda: number, figura: number): void {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let indice = 0; indice < binario.length; indice += 1) {
    bytes[indice] = binario.charCodeAt(indice);
  }
  saveBlob(
    exportFilename(`cuaderno-celda-${celda}-grafico-${figura}`, 'png'),
    new Blob([bytes], { type: 'image/png' }),
  );
}

/**
 * Qué decirle a quien ejecuta una celda que no devolvió nada, en SU lenguaje.
 *
 * El texto era uno solo y hablaba de Python. Sobre una celda de R eso es un consejo falso —el
 * problema no es dónde está la expresión sino que una asignación en R es invisible por diseño— y
 * sobre una de JavaScript manda a hacer algo que allí no existe: sin `return`, la celda no
 * devuelve. Un consejo equivocado cuesta más que ninguno: se sigue, no funciona, y quien lo siguió
 * termina desconfiando de la herramienta.
 */
const PISTA_SIN_VALOR: Record<NotebookLanguage, string> = {
  python:
    'La celda corrió sin devolver nada. Deja la expresión sola en la última línea para verla.',
  r: 'La celda corrió sin devolver nada. En R una asignación (`x <- …`) es invisible a propósito: escribe el nombre solo en la última línea para ver su valor.',
  javascript:
    'La celda corrió sin devolver nada. En JavaScript hace falta un `return` con lo que quieras ver.',
};

interface NotebookCellOutputProps {
  outcome: CellOutcome;
  /** Número de celda, 1-indexado: sólo para rotular la descarga y el texto alternativo. */
  numero: number;
  /** El lenguaje de la celda: decide qué consejo se da cuando no devolvió nada. */
  language: NotebookLanguage;
  policies: NotebookColumn[];
}

export function NotebookCellOutput({
  outcome,
  numero,
  language,
  policies,
}: NotebookCellOutputProps) {
  const tabla =
    outcome.status === 'ok' ? (outcome.table ?? tableFromValue(outcome.value)) : undefined;
  const imagenes = outcome.status === 'ok' ? (outcome.images ?? []) : [];

  return (
    <div
      className={`notebook-cell__output notebook-cell__output--${outcome.status}`}
      role={outcome.status === 'error' ? 'alert' : undefined}
    >
      {/*
       * Un resultado RESTAURADO se rotula con su fecha, y va arriba del todo.
       *
       * Es la pieza que hace honesto guardar el avance. Lo que se ve debajo se calculó en otro
       * momento, contra los datos de entonces; los de hoy pueden ser otros. Sin este renglón, un
       * cuaderno reabierto es indistinguible de uno recién ejecutado —misma tabla, mismo gráfico,
       * mismos milisegundos— y ésa es exactamente la confusión que convierte un número viejo en una
       * conclusión nueva.
       */}
      {outcome.savedAt ? (
        <p className="notebook-cell__restaurado">
          <History aria-hidden="true" size={14} /> Resultado guardado el{' '}
          {new Date(outcome.savedAt).toLocaleString()}. Vuelve a ejecutar la celda para medirlo
          contra los datos de ahora.
        </p>
      ) : null}

      {outcome.logs.length > 0 ? (
        <pre className="notebook-cell__logs">{outcome.logs.join('\n')}</pre>
      ) : null}

      {outcome.status === 'error' ? (
        <pre className="notebook-cell__error">{outcome.error}</pre>
      ) : null}

      {imagenes.length ? (
        <div className="notebook-cell__figuras" data-testid="notebook-figuras">
          {imagenes.map((imagen, posicion) => (
            <figure key={imagen.slice(-32)} className="notebook-cell__figura">
              {/*
               * `img` con `data:` y no un `canvas`: la imagen ya viene renderizada de matplotlib,
               * así se puede guardar también con el menú del navegador y no hay nada que volver a
               * dibujar cada vez que la celda se re-renderiza.
               */}
              <img
                src={imagen}
                alt={`Gráfico ${posicion + 1} de la celda ${numero}`}
                loading="lazy"
              />
              <figcaption>
                <button
                  type="button"
                  className="button"
                  onClick={() => descargarFigura(imagen, numero, posicion + 1)}
                >
                  <Download aria-hidden="true" size={14} /> Descargar PNG
                </button>
              </figcaption>
            </figure>
          ))}
        </div>
      ) : null}

      {outcome.status === 'ok' && tabla ? (
        <ResultTable table={tabla} name={`celda-${numero}`} policies={policies} />
      ) : null}

      {outcome.status === 'ok' && !tabla && outcome.value !== undefined ? (
        <pre className="notebook-cell__value">
          {typeof outcome.value === 'string'
            ? outcome.value
            : JSON.stringify(outcome.value, null, 2)}
        </pre>
      ) : null}

      {/*
       * «No devolvió nada» sólo se dice cuando ADEMÁS no imprimió ni dibujó. Una celda que sólo
       * hace `plt.plot(...)` no devuelve valor y sí produjo algo: decirle que no devolvió nada
       * mandaría a arreglar lo que ya funciona.
       */}
      {outcome.status === 'ok' &&
      !tabla &&
      outcome.value === undefined &&
      !imagenes.length &&
      outcome.logs.length === 0 ? (
        <p className="notebook-cell__silent">{PISTA_SIN_VALOR[language]}</p>
      ) : null}

      <p className="notebook-cell__timing">{outcome.durationMs} ms</p>
    </div>
  );
}
