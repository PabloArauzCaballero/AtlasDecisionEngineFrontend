'use client';

import { useCallback, useRef, useState } from 'react';
import { LENGUAJES } from './language-catalog';
import type {
  CellOutcome,
  NotebookCell,
  NotebookCellKind,
  NotebookLanguage,
} from './notebook-types';

/** Una celda tal como llega de un cuaderno guardado: con lo que arrojó la última vez. */
type LoadedCell = {
  kind: NotebookCellKind;
  language: NotebookLanguage;
  source: string;
  outcome?: CellOutcome | null;
};

/**
 * El estado del cuaderno: qué celdas hay, en qué orden y qué produjo cada una.
 *
 * Vive aparte de la pantalla para que la parte que se puede razonar sin navegador —insertar,
 * mover, borrar, numerar ejecuciones— sea comprobable sin montar React ni cargar un intérprete de
 * Python de 20 MB.
 */

/** La plantilla sale del catálogo de identidad, que es donde vive todo lo demás del lenguaje. */
const plantillaDe = (language: NotebookLanguage) => LENGUAJES[language].plantilla;

/**
 * Lo que trae una celda de comentario recién creada: se ve algo, y se ve qué se puede escribir.
 *
 * Se exporta porque la vista la usa para decidir si abre en edición: una celda que todavía es la
 * plantilla no se ha escrito, y enseñarla ya renderizada obliga a pulsar «Editar» para empezar.
 */
export const PLANTILLA_COMENTARIO = `## Qué muestra este tramo\n\nEscribe aquí la lectura: **qué** se midió, sobre cuántas filas y qué NO dice.`;

let secuencia = 0;

function nuevaCelda(
  kind: NotebookCell['kind'],
  language: NotebookLanguage,
  source?: string,
): NotebookCell {
  secuencia += 1;
  return {
    id: `celda-${secuencia}`,
    kind,
    language,
    source: source ?? (kind === 'markdown' ? PLANTILLA_COMENTARIO : plantillaDe(language)),
    outcome: null,
    running: false,
    executionCount: null,
  };
}

export function useNotebookCells() {
  const [cells, setCells] = useState<NotebookCell[]>(() => [nuevaCelda('code', 'python')]);
  // Contador de ejecuciones, compartido por todas las celdas: es lo que hace que `[3]` y `[7]`
  // signifiquen «ésta corrió antes que aquélla» y no «ésta es la tercera celda».
  const contador = useRef(0);

  const patch = useCallback((id: string, cambio: Partial<NotebookCell>) => {
    setCells((previas) =>
      previas.map((celda) => (celda.id === id ? { ...celda, ...cambio } : celda)),
    );
  }, []);

  /** Con `source` se reusa una celda del historial; sin él se añade una en blanco. */
  const addCell = useCallback((language: NotebookLanguage, source?: string) => {
    setCells((previas) => [...previas, nuevaCelda('code', language, source)]);
  }, []);

  /** Un comentario. El lenguaje que lleva dentro es indiferente y no se usa: la celda no corre. */
  const addMarkdown = useCallback((source?: string) => {
    setCells((previas) => [...previas, nuevaCelda('markdown', 'python', source)]);
  }, []);

  /**
   * Mete una celda EN MEDIO, después de la que se indique.
   *
   * Un cuaderno no se escribe de arriba abajo de una vez: se lee lo que ya hay, se ve que falta un
   * paso entre dos que ya funcionan, y se mete ahí. Sin esto la única salida era añadir al final y
   * subirla a golpe de flecha tantas veces como celdas hubiera por encima —o peor, reescribir el
   * análisis en el orden que la herramienta imponía—.
   *
   * `afterId` a `null` inserta AL PRINCIPIO, que es el caso que no tiene «celda anterior» y el que
   * hace falta para encabezar un cuaderno con un comentario cuando ya está escrito.
   */
  const insertCell = useCallback(
    (
      afterId: string | null,
      kind: NotebookCellKind,
      language: NotebookLanguage,
      source?: string,
    ) => {
      setCells((previas) => {
        const celda = nuevaCelda(kind, language, source);
        if (afterId === null) return [celda, ...previas];
        const indice = previas.findIndex((otra) => otra.id === afterId);
        // Una referencia que ya no existe —la celda se borró mientras el menú estaba abierto— va al
        // final en vez de perderse: quien pulsó quiere una celda, y dársela mal colocada es mejor
        // que no dársela y dejarle preguntándose si el botón funciona.
        if (indice === -1) return [...previas, celda];
        return [...previas.slice(0, indice + 1), celda, ...previas.slice(indice + 1)];
      });
    },
    [],
  );

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
        const intacta = celda.source.trim() === plantillaDe(celda.language).trim();
        return {
          ...celda,
          language,
          source: intacta ? plantillaDe(language) : celda.source,
          outcome: null,
        };
      }),
    );
  }, []);

  const removeCell = useCallback((id: string) => {
    setCells((previas) =>
      previas.length === 1 ? previas : previas.filter((celda) => celda.id !== id),
    );
  }, []);

  const duplicateCell = useCallback((id: string) => {
    setCells((previas) => {
      const indice = previas.findIndex((celda) => celda.id === id);
      if (indice === -1) return previas;
      // Duplicar conserva también el TIPO: duplicar un comentario y recibir una celda de código
      // sería perder lo que se estaba copiando.
      const copia = nuevaCelda(
        previas[indice].kind,
        previas[indice].language,
        previas[indice].source,
      );
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

  /**
   * Reemplaza el cuaderno entero: al abrir uno guardado.
   *
   * Entra también el avance —lo que cada celda arrojó—, que es lo que hace que reabrir un cuaderno
   * sirva de algo. Lo que evita la lectura equivocada no es esconderlo, sino fecharlo: cada
   * resultado restaurado trae su `savedAt` y la vista lo rotula.
   */
  const replaceCells = useCallback((guardadas: readonly LoadedCell[]) => {
    setCells(
      guardadas.length
        ? guardadas.map((celda) => ({
            ...nuevaCelda(celda.kind, celda.language, celda.source),
            outcome: celda.outcome ?? null,
            // El número de ejecución NO se restaura, y el resultado SÍ.
            //
            // `[3]` significa «ésta corrió antes que aquélla» dentro de UNA sesión; traído de otra,
            // ordenaría celdas que nunca corrieron juntas. La fecha del resultado (`savedAt`) es
            // la que sitúa lo restaurado, y ésa sí viaja.
            executionCount: null,
          }))
        : [nuevaCelda('code', 'python')],
    );
    contador.current = 0;
  }, []);

  /** Se llama al cambiar de dataset: los resultados dejan de corresponder a los datos cargados. */
  const clearOutcomes = useCallback(() => {
    setCells((previas) =>
      previas.map((celda) => ({ ...celda, outcome: null, executionCount: null })),
    );
  }, []);

  return {
    cells,
    addCell,
    addMarkdown,
    insertCell,
    replaceCells,
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
