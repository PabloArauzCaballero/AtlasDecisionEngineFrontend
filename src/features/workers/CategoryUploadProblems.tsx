'use client';

import { AlertTriangle, XCircle } from 'lucide-react';
import type { ProblemaSubida } from './category-upload-errors';

/**
 * Lo que impide subir el archivo, dicho para que se pueda arreglar.
 *
 * Tres columnas y no una frase: **dónde**, **qué pasa** y **cómo se arregla**.
 * Un archivo de doscientas filas lo escribió otra persona hace dos días; sin el
 * dónde no se encuentra la fila, y sin el cómo se entra en el ciclo de
 * adivinar-reintentar que es donde se pierde la tarde.
 *
 * Los avisos se separan de los errores porque no son lo mismo: un error impide
 * subir, un aviso dice que el árbol se va a comportar distinto de lo que su
 * forma sugiere. Mezclarlos haría que se ignoraran los dos.
 */
export function CategoryUploadProblems({ problemas }: { problemas: readonly ProblemaSubida[] }) {
  if (problemas.length === 0) return null;

  const errores = problemas.filter((fallo) => fallo.severidad === 'error');
  const avisos = problemas.filter((fallo) => fallo.severidad === 'aviso');

  return (
    <div className="subida-problemas">
      {errores.length > 0 ? (
        <Bloque
          titulo={`${String(errores.length)} ${errores.length === 1 ? 'error impide' : 'errores impiden'} subir el archivo`}
          tono="error"
          problemas={errores}
        />
      ) : null}
      {avisos.length > 0 ? (
        <Bloque
          titulo={`${String(avisos.length)} ${avisos.length === 1 ? 'aviso' : 'avisos'} sobre la forma del árbol`}
          tono="aviso"
          problemas={avisos}
        />
      ) : null}
    </div>
  );
}

function Bloque({
  titulo,
  tono,
  problemas,
}: {
  titulo: string;
  tono: 'error' | 'aviso';
  problemas: readonly ProblemaSubida[];
}) {
  const Icono = tono === 'error' ? XCircle : AlertTriangle;
  return (
    <section className={`subida-bloque es-${tono}`} role={tono === 'error' ? 'alert' : 'status'}>
      <h4 className="subida-bloque-titulo">
        <Icono size={15} aria-hidden="true" /> {titulo}
      </h4>
      <ul className="subida-lista">
        {problemas.map((fallo, indice) => (
          <li key={`${fallo.codigo}-${fallo.donde}-${String(indice)}`}>
            <code className="subida-donde">{fallo.donde}</code>
            <div className="subida-detalle">
              <p className="subida-mensaje">{fallo.mensaje}</p>
              <p className="subida-arreglo">{fallo.arreglo}</p>
            </div>
            {/* El código va a la vista, no escondido en la consola: es lo que se
                pega en un mensaje para pedir ayuda sin transcribir el texto. */}
            <code className="subida-codigo">{fallo.codigo}</code>
          </li>
        ))}
      </ul>
    </section>
  );
}
