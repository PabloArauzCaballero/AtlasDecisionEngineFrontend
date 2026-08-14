'use client';

import { useCallback, useRef, useState } from 'react';
import type { CellOutcome, NotebookCell, NotebookLanguage } from './notebook-types';

/**
 * El estado del cuaderno: qué celdas hay, en qué orden y qué produjo cada una.
 *
 * Vive aparte de la pantalla para que la parte que se puede razonar sin navegador —insertar,
 * mover, borrar, numerar ejecuciones— sea comprobable sin montar React ni cargar un intérprete de
 * Python de 20 MB.
 */

const PLANTILLAS: Record<NotebookLanguage, string> = {
  python: `# rows es la página cargada; df es el mismo dato como DataFrame de pandas.\ndf.head()`,
  javascript: `// rows es la página cargada. Devuelve una lista de objetos para ver una tabla.\nreturn rows.slice(0, 10);`,
};

let secuencia = 0;

function nuevaCelda(language: NotebookLanguage, source?: string): NotebookCell {
  secuencia += 1;
  return {
    id: `celda-${secuencia}`,
    language,
    source: source ?? PLANTILLAS[language],
    outcome: null,
    running: false,
    executionCount: null,
  };
}

export function useNotebookCells() {
  const [cells, setCells] = useState<NotebookCell[]>(() => [nuevaCelda('python')]);
  // Contador de ejecuciones, compartido por todas las celdas: es lo que hace que `[3]` y `[7]`
  // signifiquen «ésta corrió antes que aquélla» y no «ésta es la tercera celda».
  const contador = useRef(0);

  const patch = useCallback((id: string, cambio: Partial<NotebookCell>) => {
    setCells((previas) => previas.map((celda) => (celda.id === id ? { ...celda, ...cambio } : celda)));
  }, []);

  const addCell = useCallback((language: NotebookLanguage) => {
    setCells((previas) => [...previas, nuevaCelda(language)]);
  }, []);

  const setSource = useCallback(
    (id: string, source: string) => {
      patch(id, { source });
    },
    [patch],
  );

  const setLanguage = useCallback((id: string, language: NotebookLanguage) => {
    setCells((previas) =>
      previas.map((celda) => {
        if (celda.id !== id) return celda;
        // Cambiar de lenguaje CONSERVA el código: quien lo hace suele estar traduciendo lo que ya
        // escribió, y borrárselo por debajo sería perder trabajo sin avisar. Sólo se rellena la
        // plantilla si la celda seguía intacta.
        const intacta = celda.source.trim() === PLANTILLAS[celda.language].trim();
        return {
          ...celda,
          language,
          source: intacta ? PLANTILLAS[language] : celda.source,
          outcome: null,
        };
      }),
    );
  }, []);

  const removeCell = useCallback((id: string) => {
    setCells((previas) => (previas.length === 1 ? previas : previas.filter((celda) => celda.id !== id)));
  }, []);

  const duplicateCell = useCallback((id: string) => {
    setCells((previas) => {
      const indice = previas.findIndex((celda) => celda.id === id);
      if (indice === -1) return previas;
      const copia = nuevaCelda(previas[indice].language, previas[indice].source);
      return [...previas.slice(0, indice + 1), copia, ...previas.slice(indice + 1)];
    });
  }, []);

  const moveCell = useCallback((id: string, direction: -1 | 1) => {
    setCells((previas) => {
      const indice = previas.findIndex((celda) => celda.id === id);
      const destino = indice + direction;
      if (indice === -1 || destino < 0 || destino >= previas.length) return previas;
      const copia = [...previas];
      [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
      return copia;
    });
  }, []);

  const startRun = useCallback(
    (id: string) => {
      patch(id, { running: true, outcome: null });
    },
    [patch],
  );

  const finishRun = useCallback(
    (id: string, outcome: CellOutcome) => {
      contador.current += 1;
      patch(id, { running: false, outcome, executionCount: contador.current });
    },
    [patch],
  );

  /** Se llama al cambiar de dataset: los resultados dejan de corresponder a los datos cargados. */
  const clearOutcomes = useCallback(() => {
    setCells((previas) => previas.map((celda) => ({ ...celda, outcome: null, executionCount: null })));
  }, []);

  return {
    cells,
    addCell,
    setSource,
    setLanguage,
    removeCell,
    duplicateCell,
    moveCell,
    startRun,
    finishRun,
    clearOutcomes,
  };
}
