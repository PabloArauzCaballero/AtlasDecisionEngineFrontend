'use client';

import { ArrowDown, ArrowUp, Copy, Loader2, Play, Trash2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { NotebookColumn } from './notebook.api';
import { tableFromValue } from './notebook-export';
import type { NotebookCell } from './notebook-types';
import { ResultTable } from './ResultTable';

interface NotebookCellViewProps {
  cell: NotebookCell;
  index: number;
  total: number;
  policies: NotebookColumn[];
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
  onChange,
  onRun,
  onDelete,
  onDuplicate,
  onMove,
  onLanguage,
}: NotebookCellViewProps) {
  const areaRef = useRef<HTMLTextAreaElement>(null);

  // El área crece con el contenido: una barra de desplazamiento dentro de seis líneas de código
  // obliga a desplazar dos veces —la celda y la página— para leer algo que cabía.
  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    area.style.height = 'auto';
    area.style.height = `${Math.max(area.scrollHeight, 72)}px`;
  }, [cell.source]);

  const tablaDeSalida =
    cell.outcome?.status === 'ok'
      ? (cell.outcome.table ?? tableFromValue(cell.outcome.value))
      : undefined;

  return (
    <article className="notebook-cell" aria-label={`Celda ${index + 1} de ${total}`}>
      <div className="notebook-cell__gutter">
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
      </div>

      <div className="notebook-cell__body">
        <div className="notebook-cell__bar">
          <label className="notebook-cell__language">
            <span className="sr-only">Lenguaje de la celda {index + 1}</span>
            <select
              value={cell.language}
              onChange={(evento) => onLanguage(evento.target.value as NotebookCell['language'])}
            >
              <option value="python">Python</option>
              <option value="javascript">JavaScript</option>
            </select>
          </label>
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

        <textarea
          ref={areaRef}
          className="notebook-cell__code"
          value={cell.source}
          spellCheck={false}
          aria-label={`Código de la celda ${index + 1}`}
          placeholder={
            cell.language === 'python'
              ? 'df.groupby("status").size()'
              : 'return rows.filter((fila) => fila.status === "ACTIVE")'
          }
          onChange={(evento) => onChange(evento.target.value)}
          onKeyDown={(evento) => {
            // Ctrl/Cmd+Enter ejecuta, como en cualquier cuaderno. Enter a secas escribe una línea:
            // cambiar eso convertiría un salto de línea accidental en una ejecución.
            if ((evento.ctrlKey || evento.metaKey) && evento.key === 'Enter') {
              evento.preventDefault();
              onRun();
            }
          }}
        />

        {cell.outcome ? (
          <div
            className={`notebook-cell__output notebook-cell__output--${cell.outcome.status}`}
            role={cell.outcome.status === 'error' ? 'alert' : undefined}
          >
            {cell.outcome.logs.length > 0 ? (
              <pre className="notebook-cell__logs">{cell.outcome.logs.join('\n')}</pre>
            ) : null}

            {cell.outcome.status === 'error' ? (
              <pre className="notebook-cell__error">{cell.outcome.error}</pre>
            ) : null}

            {cell.outcome.status === 'ok' && tablaDeSalida ? (
              <ResultTable table={tablaDeSalida} name={`celda-${index + 1}`} policies={policies} />
            ) : null}

            {cell.outcome.status === 'ok' && !tablaDeSalida && cell.outcome.value !== undefined ? (
              <pre className="notebook-cell__value">
                {typeof cell.outcome.value === 'string'
                  ? cell.outcome.value
                  : JSON.stringify(cell.outcome.value, null, 2)}
              </pre>
            ) : null}

            {cell.outcome.status === 'ok' &&
            !tablaDeSalida &&
            cell.outcome.value === undefined &&
            cell.outcome.logs.length === 0 ? (
              <p className="notebook-cell__silent">
                La celda corrió sin devolver nada. En Python, deja la expresión sola en la última
                línea para verla.
              </p>
            ) : null}

            <p className="notebook-cell__timing">{cell.outcome.durationMs} ms</p>
          </div>
        ) : null}
      </div>
    </article>
  );
}
