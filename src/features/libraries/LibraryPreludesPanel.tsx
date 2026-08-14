'use client';

import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../api/http-client';
import { Panel } from '../../components/Panel';
import { asRecord, asRows } from '../../utils/records';

/**
 * Qué funciones deja disponibles cada librería aprobada dentro del sandbox.
 *
 * `GET /v1/libraries/preludes` estaba exento como «deuda menor», y era menor sólo en esfuerzo.
 * En consecuencia no: el registro decía qué librerías están aprobadas, y no qué se puede
 * escribir con ellas. Quien va a redactar el script de un nodo tenía la lista de paquetes y
 * ninguna forma de saber si `npv` existe — salvo escribirlo, guardar, ejecutar y ver si el
 * sandbox lo rechaza. Eso convierte una consulta de dos segundos en un ciclo de prueba y error
 * sobre un artefacto de decisión.
 *
 * Se muestra por LENGUAJE y no fusionado: una librería puede tener implementación en Python y
 * no en JavaScript, y fusionarlas ofrecería funciones que en el lenguaje elegido no existen —
 * exactamente el error que este panel viene a evitar.
 */
interface Prelude {
  packageName: string;
  javascript: string[] | null;
  python: string[] | null;
}

function leerPreludes(payload: unknown): Prelude[] {
  return asRows(asRecord(payload).items).map((fila) => {
    const js = fila.javascript ? asRecord(fila.javascript) : null;
    const py = fila.python ? asRecord(fila.python) : null;
    return {
      packageName: String(fila.packageName ?? ''),
      // `null` y `[]` significan cosas distintas: «no hay implementación en este lenguaje» no es
      // «la hay y no expone nada». La primera se dice, la segunda también, y no son la misma.
      javascript: js ? ((js.functions as string[] | undefined) ?? []) : null,
      python: py ? ((py.functions as string[] | undefined) ?? []) : null,
    };
  });
}

function ListaFunciones({ titulo, funciones }: { titulo: string; funciones: string[] | null }) {
  if (funciones === null) {
    return (
      <p className="field-help">
        {titulo}: <em>sin implementación</em>
      </p>
    );
  }
  if (funciones.length === 0) {
    return <p className="field-help">{titulo}: implementada, sin funciones expuestas todavía.</p>;
  }
  return (
    <p className="field-help">
      {titulo}:{' '}
      {funciones.map((nombre) => (
        <code className="mono" key={nombre}>
          {nombre}{' '}
        </code>
      ))}
    </p>
  );
}

export function LibraryPreludesPanel() {
  const query = useQuery({
    queryKey: ['library-preludes'],
    queryFn: ({ signal }) => apiRequest<unknown>('/v1/libraries/preludes', { signal }),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  const preludes = leerPreludes(query.data);
  // Sin datos no se pinta un panel vacío: un recuadro que dice «0 preludios» sobre un motor que
  // simplemente no respondió se lee como «no hay ninguno», que es una afirmación distinta.
  if (query.isError || (!query.isPending && preludes.length === 0)) return null;

  return (
    <Panel
      title="Qué se puede llamar desde un script"
      meta={query.isPending ? 'Cargando…' : `${preludes.length} preludios`}
    >
      <p className="field-help">
        Cada librería aprobada precarga estas funciones dentro del sandbox. Aquí están por lenguaje:
        una librería puede existir en Python y no en JavaScript, y ofrecer una función que el
        lenguaje elegido no tiene sólo se descubriría al ejecutar.
      </p>
      <ul className="library-preludes">
        {preludes.map((prelude) => (
          <li key={prelude.packageName}>
            <strong className="mono">{prelude.packageName}</strong>
            <ListaFunciones titulo="JavaScript" funciones={prelude.javascript} />
            <ListaFunciones titulo="Python" funciones={prelude.python} />
          </li>
        ))}
      </ul>
    </Panel>
  );
}
