'use client';

import { CircleCheck, TriangleAlert } from 'lucide-react';

/**
 * Las notas de una ejecución: lo que quedó dicho y no cabe en el veredicto.
 *
 * ## Por qué es una sola pieza para los cuatro workers
 *
 * Porque la nota de un extracto y la de una cédula son la misma cosa —«esto
 * salió, pero apúntate esto»— y hasta ahora sólo la pintaba la consola de
 * extractos. Los otros tres workers emiten avisos que el motor publica y que
 * nadie veía: quedaban dentro de la traza descargable, o sea, a un clic y un
 * editor de JSON de distancia de la persona que estaba mirando la pantalla.
 *
 * ## Por qué se enseña TAMBIÉN cuando no hay ninguna
 *
 * Por lo mismo que `StatementAuthenticityNote`: la ausencia de un aviso no es
 * una afirmación. Un bloque que sólo aparece cuando algo va mal deja a quien
 * revisa sin poder distinguir «se comprobó y no hubo nada que apuntar» de «esta
 * pantalla no muestra notas», y las dos se ven igual —una pantalla vacía—.
 * Decirlo en una línea cuesta una línea.
 *
 * ## Por qué el código va a la vista
 *
 * Esta consola la mira quien opera el motor, no el solicitante. La frase en
 * español es para leerla; el código es el contrato —viaja a auditoría, se busca
 * en los registros y se cita en un ticket—, y esconderlo obligaría a abrir el
 * JSON crudo para poder nombrar lo que se está viendo en pantalla.
 */
export interface WorkerNote {
  /** La frase en español. Es lo único obligatorio: sin texto no hay nota. */
  readonly texto: string;
  /**
   * El código del contrato, cuando la nota viene de uno. Opcional porque hay
   * avisos que el motor publica ya redactados y no tienen código detrás.
   */
  readonly codigo?: string;
  /**
   * De qué parte de la ejecución salió —«documento», «selfie», «análisis»—.
   *
   * Importa más de lo que parece: «La imagen tiene poca resolución» dicho de la
   * cédula y dicho de la selfie mandan a hacer dos cosas distintas, y sin esta
   * palabra las dos notas se leen idénticas.
   */
  readonly origen?: string;
}

interface WorkerNotesProps {
  readonly notas: readonly WorkerNote[];
  /** Qué se hace con ellas. Cada worker lo dice a su manera. */
  readonly ayuda?: string;
}

const AYUDA_POR_DEFECTO =
  'El resultado es utilizable, pero estos puntos quedaron sin resolver del todo. ' +
  'Conviene contrastarlos con el original antes de darlo por bueno.';

export function WorkerNotes({ notas, ayuda }: WorkerNotesProps) {
  if (notas.length === 0) {
    return (
      <section className="worker-notes is-empty">
        <h3 className="worker-section-title">
          Notas
          <span className="worker-notes-count">ninguna</span>
        </h3>
        <p className="worker-notes-empty">
          <CircleCheck size={15} aria-hidden="true" />
          La ejecución no dejó ningún punto pendiente.
        </p>
      </section>
    );
  }

  return (
    <section className="worker-notes">
      <h3 className="worker-section-title">
        Notas
        <span className="worker-notes-count">{notas.length}</span>
      </h3>
      <p className="field-help">{ayuda ?? AYUDA_POR_DEFECTO}</p>
      {/*
       * Lista y no tabla: son frases de largo desigual, y una tabla las obliga a
       * compartir ancho de columna con el código, que es corto. En un teléfono
       * eso deja la frase en una tira de dos palabras por línea.
       */}
      <ul className="worker-notes-list">
        {notas.map((nota, indice) => (
          <li key={nota.codigo ? `${nota.codigo}-${String(indice)}` : String(indice)}>
            <TriangleAlert className="worker-note-icon" size={15} aria-hidden="true" />
            <span className="worker-note-text">{nota.texto}</span>
            {/*
             * El origen antes que el código: responde «¿de qué imagen hablas?»,
             * que es la pregunta que se hace primero al leer la frase.
             */}
            {nota.origen ? <span className="worker-note-origin">{nota.origen}</span> : null}
            {nota.codigo ? <code className="worker-note-code">{nota.codigo}</code> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Convierte los avisos crudos del motor en notas, traduciendo los que se
 * reconozcan.
 *
 * El código se conserva SIEMPRE, también cuando hay traducción: la frase es
 * para entenderlo y el código es para buscarlo. Y un código sin traducción se
 * pinta tal cual en vez de esconderse —una nota que el portal no sabe nombrar
 * sigue siendo una nota, y ocultarla sería mentir sobre cuántas hubo—.
 */
export function notasDesdeCodigos(
  codigos: readonly string[],
  etiquetas: Readonly<Record<string, string>>,
  origen?: string,
): WorkerNote[] {
  return codigos.map((codigo) => ({
    texto: etiquetas[codigo] ?? codigo,
    codigo,
    origen,
  }));
}
