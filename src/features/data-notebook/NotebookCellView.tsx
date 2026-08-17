'use client';

import { ArrowDown, ArrowUp, Copy, Eye, Loader2, Pencil, Play, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { MarkdownView } from './MarkdownView';
import type { NotebookColumn } from './notebook.api';
import { NotebookCellOutput } from './NotebookCellOutput';
import { NotebookCodeEditor } from './NotebookCodeEditor';
import type { SimboloNotebook } from './notebook-symbols';
import type { NotebookCell } from './notebook-types';
import { LENGUAJES, marcaDeCelda, ORDEN_LENGUAJES } from './language-catalog';
import { PLANTILLA_COMENTARIO } from './useNotebookCells';

interface NotebookCellViewProps {
  cell: NotebookCell;
  index: number;
  total: number;
  policies: NotebookColumn[];
  /** Lo que esta celda puede nombrar: API, columnas del dataset y memoria de variables. */
  simbolos: readonly SimboloNotebook[];
  onChange: (source: string) => void;
  onRun: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMove: (direction: -1 | 1) => void;
  onLanguage: (language: NotebookCell['language']) => void;
}

/**
 * Una celda, con la forma que tiene en un cuaderno y no en un formulario.
 *
 * El canalón de la izquierda lleva el botón de ejecutar y el número de ejecución entre corchetes.
 * Ese número no es decorativo: en un cuaderno las celdas se corren en el orden que uno quiere, no
 * de arriba abajo, y `[3]` encima de `[7]` es la única señal de que lo que se está mirando se
 * calculó ANTES que lo de abajo. Sin él, un resultado viejo junto a un código nuevo parece
 * coherente.
 */
export function NotebookCellView({
  cell,
  index,
  total,
  policies,
  simbolos,
  onChange,
  onRun,
  onDelete,
  onDuplicate,
  onMove,
  onLanguage,
}: NotebookCellViewProps) {
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const comentario = cell.kind === 'markdown';
  /*
   * Un comentario recién puesto abre en EDICIÓN; uno ya escrito abre RENDERIZADO.
   *
   * Es la diferencia entre crear y releer. Abrir siempre renderizado obliga a pulsar «Editar» para
   * empezar a escribir en una celda que acabas de crear —y lo primero que se ve es una plantilla
   * que no dice nada—; abrir siempre en edición convierte un cuaderno guardado en una pila de
   * texto en crudo, que es justo lo que estas celdas venían a evitar.
   */
  const [editando, setEditando] = useState(
    () => cell.source.trim() === '' || cell.source.trim() === PLANTILLA_COMENTARIO.trim(),
  );

  // El área crece con el contenido: una barra de desplazamiento dentro de seis líneas de código
  // obliga a desplazar dos veces —la celda y la página— para leer algo que cabía.
  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    area.style.height = 'auto';
    area.style.height = `${Math.max(area.scrollHeight, 72)}px`;
  }, [cell.source]);

  return (
    /*
     * `data-language` es lo que la hoja de estilos lee para pintar la identidad del lenguaje: el
     * filete de la izquierda y el punto de la barra. Va en el atributo y no en una clase por celda
     * porque el color vive en `theme.css` y aquí no puede escribirse ninguno — la regla del
     * repositorio, y la que evita que la marca quede ilegible al conmutar a tema oscuro.
     */
    <article
      className="notebook-cell"
      data-language={marcaDeCelda(cell.kind, cell.language)}
      aria-label={`Celda ${index + 1} de ${total}`}
    >
      <div className="notebook-cell__gutter">
        {/*
         * El canalón de un comentario está VACÍO, y eso es información: sin botón de ejecutar y
         * sin corchetes se ve de un vistazo que ese bloque no produjo ningún resultado. Un `[ ]`
         * junto a un párrafo se leería como una celda que nadie ha corrido todavía.
         */}
        {comentario ? null : (
          <>
            <button
              type="button"
              className="notebook-cell__run"
              onClick={onRun}
              disabled={cell.running}
              aria-label={`Ejecutar celda ${index + 1}`}
              title="Ejecutar (Ctrl+Enter)"
            >
              {cell.running ? (
                <Loader2 aria-hidden="true" size={16} className="notebook-cell__spin" />
              ) : (
                <Play aria-hidden="true" size={16} />
              )}
            </button>
            <span className="notebook-cell__count" aria-label="Número de ejecución">
              [{cell.running ? '*' : (cell.executionCount ?? ' ')}]
            </span>
          </>
        )}
      </div>

      <div className="notebook-cell__body">
        <div className="notebook-cell__bar">
          {comentario ? (
            <div className="notebook-cell__language">
              <span className="notebook-cell__marca" aria-hidden="true" />
              <span className="notebook-cell__kind">Comentario</span>
              <button
                type="button"
                className="button"
                onClick={() => setEditando((previo) => !previo)}
                aria-label={
                  editando
                    ? `Ver el comentario ${index + 1} renderizado`
                    : `Editar el comentario ${index + 1}`
                }
              >
                {editando ? (
                  <>
                    <Eye aria-hidden="true" size={14} /> Ver
                  </>
                ) : (
                  <>
                    <Pencil aria-hidden="true" size={14} /> Editar
                  </>
                )}
              </button>
            </div>
          ) : (
            <label className="notebook-cell__language">
              <span className="sr-only">Lenguaje de la celda {index + 1}</span>
              {/* El punto es DECORATIVO: quien no distinga los tres tonos lee el nombre en el
                  propio desplegable, que es donde ya estaba. El color añade velocidad, no dato. */}
              <span className="notebook-cell__marca" aria-hidden="true" />
              <select
                value={cell.language}
                onChange={(evento) => onLanguage(evento.target.value as NotebookCell['language'])}
              >
                {ORDEN_LENGUAJES.map((lenguaje) => (
                  <option key={lenguaje} value={lenguaje}>
                    {LENGUAJES[lenguaje].label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="notebook-cell__tools">
            <button
              type="button"
              className="button"
              onClick={() => onMove(-1)}
              disabled={index === 0}
              aria-label={`Subir celda ${index + 1}`}
              title="Subir"
            >
              <ArrowUp aria-hidden="true" size={14} />
            </button>
            <button
              type="button"
              className="button"
              onClick={() => onMove(1)}
              disabled={index === total - 1}
              aria-label={`Bajar celda ${index + 1}`}
              title="Bajar"
            >
              <ArrowDown aria-hidden="true" size={14} />
            </button>
            <button
              type="button"
              className="button"
              onClick={onDuplicate}
              aria-label={`Duplicar celda ${index + 1}`}
              title="Duplicar"
            >
              <Copy aria-hidden="true" size={14} />
            </button>
            <button
              type="button"
              className="button"
              onClick={onDelete}
              disabled={total === 1}
              aria-label={`Eliminar celda ${index + 1}`}
              title={total === 1 ? 'Un cuaderno no puede quedarse sin celdas' : 'Eliminar'}
            >
              <Trash2 aria-hidden="true" size={14} />
            </button>
          </div>
        </div>

        {comentario && !editando ? (
          <div
            className="notebook-cell__markdown"
            onDoubleClick={() => setEditando(true)}
            aria-label={`Comentario ${index + 1}`}
          >
            <MarkdownView source={cell.source} />
          </div>
        ) : comentario ? (
          <textarea
            ref={areaRef}
            className="notebook-cell__code"
            value={cell.source}
            spellCheck
            aria-label={`Comentario ${index + 1}`}
            placeholder="Anota aquí lo que este tramo significa. Admite **negrita**, listas y `código`."
            onChange={(evento) => onChange(evento.target.value)}
            onKeyDown={(evento) => {
              if (!((evento.ctrlKey || evento.metaKey) && evento.key === 'Enter')) return;
              evento.preventDefault();
              // En un comentario, Ctrl+Enter CONFIRMA —lo mismo que en cualquier cuaderno: deja de
              // editar y enseña el resultado—. Lo que no hace es ejecutar nada.
              setEditando(false);
            }}
          />
        ) : (
          /*
           * El código va en Monaco; el comentario se queda en el `textarea` de arriba, y no es
           * una inconsistencia: en un comentario se escribe prosa, y ahí el corrector ortográfico
           * del navegador y el salto de línea natural valen más que el resaltado de sintaxis.
           */
          <NotebookCodeEditor
            language={cell.language}
            value={cell.source}
            ariaLabel={`Código de la celda ${index + 1}`}
            placeholder={LENGUAJES[cell.language].ejemplo}
            simbolos={simbolos}
            onChange={onChange}
            onRun={onRun}
          />
        )}

        {cell.outcome ? (
          <NotebookCellOutput
            outcome={cell.outcome}
            numero={index + 1}
            language={cell.language}
            policies={policies}
          />
        ) : null}
      </div>
    </article>
  );
}
