'use client';

import { COMENTARIO, LENGUAJES, ORDEN_LENGUAJES } from './language-catalog';
import type { NotebookCellKind, NotebookLanguage } from './notebook-types';

interface NotebookInsertBarProps {
  /** Después de qué celda se inserta. `null` es al principio del cuaderno. */
  afterId: string | null;
  /** Posición humana, para que el lector de pantalla diga dónde va a caer la celda. */
  posicion: number;
  onInsert: (kind: NotebookCellKind, language: NotebookLanguage) => void;
}

/**
 * La franja entre dos celdas: donde se mete lo que faltaba.
 *
 * ## Por qué está entre las celdas y no en una barra de herramientas
 *
 * El sitio donde va la celda nueva ES la información. Un botón «Añadir» arriba obliga a decir
 * después dónde va —moviéndola, o eligiendo en un desplegable— y las dos formas piden traducir una
 * posición que ya se sabía a un número o a una cuenta de pulsaciones. Aquí se pulsa donde se quiere
 * que aparezca, que es como se piensa un cuaderno.
 *
 * ## Por qué se ve al pasar por encima y no siempre
 *
 * Entre veinte celdas, veinte franjas siempre visibles compiten con el contenido y parten la
 * lectura. Se revelan al acercar el ratón —y con el foco del teclado, que es la mitad que suele
 * olvidarse: sin `:focus-within` la función existiría sólo para quien usa ratón—.
 *
 * ## Por qué los botones se GENERAN
 *
 * Uno por lenguaje, sacados de `language-catalog.ts`. Escritos a mano eran tres bloques casi
 * idénticos, y al aparecer el tercer lenguaje quedó a la vista lo que eso cuesta: un icono, un
 * rótulo y un texto de ayuda que hay que acordarse de añadir aquí además de en otros cuatro sitios.
 */
export function NotebookInsertBar({ afterId, posicion, onInsert }: NotebookInsertBarProps) {
  const donde = afterId === null ? 'al principio' : `en la posición ${posicion}`;

  return (
    <div className="notebook-insert" data-testid="notebook-insert">
      <span className="notebook-insert__linea" aria-hidden="true" />
      <div className="notebook-insert__acciones">
        {ORDEN_LENGUAJES.map((lenguaje) => {
          const { label, Icon } = LENGUAJES[lenguaje];
          return (
            <button
              key={lenguaje}
              type="button"
              className="notebook-insert__boton"
              data-language={lenguaje}
              onClick={() => onInsert('code', lenguaje)}
              aria-label={`Insertar celda de ${label} ${donde}`}
              title={`Insertar celda de ${label} aquí`}
            >
              <Icon aria-hidden="true" size={13} /> {label}
            </button>
          );
        })}
        <button
          type="button"
          className="notebook-insert__boton"
          data-language="markdown"
          onClick={() => onInsert('markdown', 'python')}
          aria-label={`Insertar comentario ${donde}`}
          title="Insertar comentario aquí"
        >
          <COMENTARIO.Icon aria-hidden="true" size={13} /> {COMENTARIO.label}
        </button>
      </div>
      <span className="notebook-insert__linea" aria-hidden="true" />
    </div>
  );
}
