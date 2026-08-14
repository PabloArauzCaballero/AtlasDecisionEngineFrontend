'use client';

import { useRef, useState } from 'react';
import { ClipboardCopy, Download, FileUp, ListChecks } from 'lucide-react';
import type { SemanticCategory } from './categories.api';
import {
  COLUMNAS_PENDIENTES,
  contratoDePendientes,
  leerAsignaciones,
  pendientesACsv,
  RespuestaInvalida,
  type AsignacionPropuesta,
} from './unresolved-contract';
import type { UnresolvedItem } from './unresolved.api';
import { saveBlob } from '../../utils/download';

/**
 * Resolver la bandeja en bloque: sacar el problema entero y devolver las
 * respuestas de golpe.
 *
 * Setenta glosas resueltas de una en una son media tarde de trabajo repetitivo.
 * «Copiar contrato» se lleva las que faltan **con el catálogo de categorías y
 * las instrucciones dentro**, para poder pegarlas donde se resuelvan; el pegado
 * de vuelta se valida contra lo que existe aquí antes de tocar nada.
 *
 * **Dos salidas y dos entradas, porque hay dos formas de decidir esto.** Con un
 * modelo se copia el contrato y se pega la respuesta; entre varias personas se
 * descarga la bandeja en CSV, se reparte por columnas en una hoja de cálculo y
 * se vuelve a subir el archivo. Obligar a convertir esa hoja a JSON antes de
 * subirla es exactamente el paso donde se cuelan las comillas sin cerrar.
 *
 * **Se aplica una por una contra el motor, no en un lote.** Cada resolución
 * escribe su alias y queda auditada con quién la hizo; un endpoint de lote
 * ahorraría peticiones y perdería exactamente eso. Se dice cuántas fueron y
 * cuántas fallaron, y las que fallen no arrastran a las demás.
 */
export function UnresolvedBulk({
  pendientes,
  categorias,
  onAplicar,
}: {
  pendientes: readonly UnresolvedItem[];
  categorias: readonly SemanticCategory[];
  /** Resuelve una asignación. Devuelve el error si lo hubo. */
  onAplicar: (asignaciones: readonly AsignacionPropuesta[]) => Promise<void>;
}) {
  const [abierto, setAbierto] = useState(false);
  const [respuesta, setRespuesta] = useState('');
  const [copiado, setCopiado] = useState(false);
  const [aviso, setAviso] = useState<{ tono: 'error' | 'aviso'; texto: string } | null>(null);
  const [aplicando, setAplicando] = useState(false);
  const archivo = useRef<HTMLInputElement>(null);

  const codigosValidos = new Set(
    categorias
      .filter((categoria) => categoria.isActive && categoria.acceptanceThreshold < 1)
      .map((categoria) => categoria.code),
  );

  async function copiar() {
    const contrato = contratoDePendientes(pendientes, categorias);
    try {
      await navigator.clipboard.writeText(contrato);
      setCopiado(true);
      setAviso(null);
    } catch {
      /*
       * El portapapeles falla sin permiso o fuera de un origen seguro. En vez de
       * dejar al usuario sin salida se abre el panel con el contrato dentro para
       * que lo copie a mano: el trabajo sigue siendo posible.
       */
      setRespuesta(contrato);
      setAbierto(true);
      setAviso({
        tono: 'aviso',
        texto: 'El navegador no dejó copiar. El contrato está aquí abajo para copiarlo a mano.',
      });
    }
  }

  /*
   * Lo subido cae en el mismo cuadro donde se pega. Aplicarlo directo ahorraría
   * un clic y quitaría el único momento en que se puede ver qué trae el archivo
   * —y corregirlo aquí mismo— antes de escribir setenta alias en el catálogo.
   */
  async function cargarArchivo(entrada: File): Promise<void> {
    setRespuesta(await entrada.text());
    setAbierto(true);
    setAviso(null);
  }

  async function aplicar() {
    setAviso(null);
    let leidas;
    try {
      leidas = leerAsignaciones(respuesta, pendientes, codigosValidos);
    } catch (error) {
      setAviso({
        tono: 'error',
        texto:
          error instanceof RespuestaInvalida ? error.message : 'No se pudo leer lo que pegaste.',
      });
      return;
    }

    if (leidas.asignaciones.length === 0) {
      setAviso({
        tono: 'error',
        texto: `No hay ninguna asignación aplicable. ${leidas.descartadas.join(' ')}`.trim(),
      });
      return;
    }

    setAplicando(true);
    try {
      await onAplicar(leidas.asignaciones);
      setRespuesta('');
      if (leidas.descartadas.length > 0) {
        // Lo descartado se DICE. Aplicar treinta de treinta y cinco en silencio
        // se lee como «se aplicaron todas», y las cinco que faltan no vuelven a
        // aparecer hasta que alguien las echa de menos.
        setAviso({
          tono: 'aviso',
          texto: `Quedaron fuera ${String(leidas.descartadas.length)}: ${leidas.descartadas.join(' ')}`,
        });
      }
    } finally {
      setAplicando(false);
    }
  }

  return (
    <div className="pendientes-bloque">
      <div className="pendientes-bloque-acciones">
        <button
          type="button"
          className="button"
          disabled={pendientes.length === 0}
          onClick={() => void copiar()}
        >
          <ClipboardCopy size={15} aria-hidden="true" />
          {copiado ? 'Contrato copiado' : `Copiar contrato (${String(pendientes.length)})`}
        </button>
        <button
          type="button"
          className="button"
          disabled={pendientes.length === 0}
          onClick={() => saveBlob('pendientes.csv', new Blob([pendientesACsv(pendientes)]))}
        >
          <Download size={15} aria-hidden="true" /> Descargar la bandeja (CSV)
        </button>
        <button type="button" className="button" onClick={() => archivo.current?.click()}>
          <FileUp size={15} aria-hidden="true" /> Subir archivo (CSV o JSON)
        </button>
        <button
          type="button"
          className="button"
          aria-expanded={abierto}
          onClick={() => setAbierto((previo) => !previo)}
        >
          <ListChecks size={15} aria-hidden="true" />
          {abierto ? 'Cerrar el pegado' : 'Aplicar en bloque'}
        </button>
      </div>

      <input
        ref={archivo}
        type="file"
        accept=".csv,.json,text/csv,application/json"
        className="sr-only"
        onChange={(evento) => {
          const elegido = evento.target.files?.[0];
          if (elegido) void cargarArchivo(elegido);
          // Se limpia para que subir DOS VECES el mismo archivo vuelva a
          // disparar el evento: si no, corregirlo fuera y reintentar no hacía
          // nada y parecía que la pantalla se había colgado.
          evento.target.value = '';
        }}
      />

      {abierto ? (
        <div className="pendientes-bloque-panel">
          <label className="field">
            <span className="field-label">Asignaciones (JSON o CSV)</span>
            <textarea
              rows={7}
              value={respuesta}
              onChange={(evento) => setRespuesta(evento.target.value)}
              placeholder={'[{ "id": "12", "categoryCode": "GASTOS.ALIMENTACION.SUPERMERCADO" }]'}
              spellCheck={false}
            />
          </label>
          <p className="field-help">
            En CSV la cabecera es <code>{COLUMNAS_PENDIENTES.join(', ')}</code> y sólo se leen{' '}
            <code>id</code> y <code>categoryCode</code>: una fila con la categoría en blanco sigue
            pendiente. Se comprueba cada línea contra la bandeja y contra el catálogo antes de
            aplicar nada. Cada asignación queda auditada por separado y enseña su alias al motor,
            igual que si se resolviera a mano.
          </p>
          {aviso === null ? null : (
            <p className={aviso.tono === 'error' ? 'field-error' : 'field-help is-aviso'}>
              {aviso.texto}
            </p>
          )}
          <button
            type="button"
            className="button is-primary"
            disabled={aplicando || respuesta.trim() === ''}
            onClick={() => void aplicar()}
          >
            {aplicando ? 'Aplicando…' : 'Aplicar las asignaciones'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
