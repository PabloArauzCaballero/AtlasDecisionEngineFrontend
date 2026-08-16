'use client';

import { useRef, useState } from 'react';
import { FileJson, FlaskConical, Upload, FileUp } from 'lucide-react';
import type { ImportSummary, SemanticCategory } from './categories.api';
import { COLUMNAS_CSV, leerCsv, leerJson } from './category-csv';
import {
  bloquean,
  revisarCategorias,
  type CategoriaSubida,
  type ProblemaSubida,
} from './category-upload-errors';
import { CategoryUploadProblems } from './CategoryUploadProblems';

/**
 * Inyección de un subárbol completo, desde JSON o desde CSV.
 *
 * Es la forma en que un catálogo se corrige de verdad. Quien descubre que su
 * banco escribe `TRASPASO CA/CC CON QR (MOVIL)` no quiere crear ocho categorías
 * a mano: quiere subir lo que ya tiene y que el motor cree los registros.
 *
 * **Dos formatos porque hay dos orígenes.** El JSON llega de otro sistema o de
 * un modelo; el CSV, de la hoja de cálculo donde varias personas revisaron el
 * árbol por columnas. Los dos acaban en la misma lista y pasan la misma revisión.
 *
 * **Se prueba en seco antes de escribir, y el botón de escribir no aparece hasta
 * entonces.** Pegar cientos de categorías se hace una vez; si además pisa filas
 * existentes sin que nadie lo haya visto venir, el clasificador cambia de opinión
 * sobre movimientos ya clasificados y nadie sabe por qué.
 */

/** Ejemplo mínimo pero completo: una rama y su hoja, con contraejemplo. */
const PLANTILLA = `[
  {
    "code": "GASTOS.MASCOTAS",
    "name": "Mascotas",
    "description": "Gastos de animales de compañía.",
    "parentCode": "GASTOS",
    "acceptanceThreshold": 1,
    "positiveExamples": [],
    "counterExamples": []
  },
  {
    "code": "GASTOS.MASCOTAS.VETERINARIA",
    "name": "Veterinaria",
    "description": "Consultas y tratamientos de un animal de compañía.",
    "parentCode": "GASTOS.MASCOTAS",
    "acceptanceThreshold": 0.62,
    "positiveExamples": ["PAGO VETERINARIA", "PAGO CONSULTA VETERINARIA"],
    "counterExamples": ["PAGO CONSULTA MEDICA"]
  }
]`;

export interface CategoryImportPanelProps {
  onProbar: (categorias: unknown[]) => void;
  onInyectar: (categorias: unknown[]) => void;
  ocupado: boolean;
  resumen: ImportSummary | null;
  /** El catálogo actual: distingue qué códigos se crean de cuáles se reemplazan. */
  catalogo: readonly SemanticCategory[];
}

export function CategoryImportPanel({
  onProbar,
  onInyectar,
  ocupado,
  resumen,
  catalogo,
}: CategoryImportPanelProps) {
  const [texto, setTexto] = useState('');
  const [problemas, setProblemas] = useState<readonly ProblemaSubida[]>([]);
  const [leidas, setLeidas] = useState<CategoriaSubida[] | null>(null);
  const archivo = useRef<HTMLInputElement>(null);

  /**
   * Lee lo que hay en el cuadro y lo revisa ENTERO antes de salir a la red.
   *
   * Un error de tecleo no es un problema del motor: hacerle dar el viaje para
   * que responda 400 convierte un paréntesis mal puesto en un fallo de servidor
   * en los registros de alguien.
   */
  function revisar(fuente: 'json' | 'csv' = detectar(texto)): CategoriaSubida[] | null {
    const lectura = fuente === 'csv' ? leerCsv(texto) : leerJson(texto);
    const existentes = new Set(catalogo.map((categoria) => categoria.code));
    const todos = [...lectura.problemas, ...revisarCategorias(lectura.categorias, existentes)];
    setProblemas(todos);
    if (bloquean(todos)) {
      setLeidas(null);
      return null;
    }
    setLeidas(lectura.categorias);
    return lectura.categorias;
  }

  async function cargarArchivo(entrada: File): Promise<void> {
    const contenido = await entrada.text();
    setTexto(contenido);
    const fuente = entrada.name.toLowerCase().endsWith('.csv') ? 'csv' : detectar(contenido);
    const lectura = fuente === 'csv' ? leerCsv(contenido) : leerJson(contenido);
    const existentes = new Set(catalogo.map((categoria) => categoria.code));
    setProblemas([...lectura.problemas, ...revisarCategorias(lectura.categorias, existentes)]);
    setLeidas(lectura.categorias);
  }

  const enSeco = resumen?.dryRun === true;

  return (
    <div className="categoria-import">
      <div className="categoria-import-cabecera">
        <h3 className="worker-section-title">
          <FileJson size={16} aria-hidden="true" /> Subir un árbol (JSON o CSV)
        </h3>
        <div className="categoria-import-formatos">
          <button
            type="button"
            className="button"
            onClick={() => archivo.current?.click()}
            disabled={ocupado}
          >
            <FileUp size={15} aria-hidden="true" /> Subir archivo
          </button>
          <button
            type="button"
            className="button"
            onClick={() => {
              setTexto(PLANTILLA);
              setProblemas([]);
              setLeidas(null);
            }}
          >
            Usar plantilla
          </button>
        </div>
      </div>

      <input
        ref={archivo}
        type="file"
        accept=".json,.csv,application/json,text/csv"
        className="sr-only"
        onChange={(evento) => {
          const elegido = evento.target.files?.[0];
          if (elegido) void cargarArchivo(elegido);
          // Se limpia para que subir DOS VECES el mismo archivo vuelva a disparar
          // el evento: si no, corregirlo fuera y reintentar no hacía nada.
          evento.target.value = '';
        }}
      />

      <p className="field-help">
        En CSV, la cabecera es <code>{COLUMNAS_CSV.join(', ')}</code> y los ejemplos van separados
        por <code>|</code>. En JSON se admiten tanto un array plano como el documento anidado que
        descarga esta pantalla. La forma más segura de empezar es bajar el catálogo actual desde{' '}
        <strong>Descargar JSON</strong> o <strong>Descargar CSV</strong>, en la barra del árbol,
        editarlo y volver a subirlo aquí. El orden de las filas no importa: el motor escribe de
        padre a hijo en una sola transacción.
      </p>

      <textarea
        className="categoria-import-json"
        value={texto}
        onChange={(evento) => {
          setTexto(evento.target.value);
          setProblemas([]);
          setLeidas(null);
        }}
        rows={12}
        spellCheck={false}
        aria-label="Árbol de categorías en JSON o CSV"
        placeholder={PLANTILLA}
      />

      <CategoryUploadProblems problemas={problemas} />

      {leidas !== null && problemas.length === 0 ? (
        <p className="field-help" role="status">
          {leidas.length} categoría(s) leídas sin problemas. Prueba en seco para ver qué se crea y
          qué se reemplaza.
        </p>
      ) : null}

      <div className="categoria-import-acciones">
        <button
          type="button"
          className="button"
          disabled={ocupado || texto.trim() === ''}
          onClick={() => {
            const categorias = revisar();
            if (categorias !== null) onProbar(categorias);
          }}
        >
          <FlaskConical size={15} aria-hidden="true" /> Probar en seco
        </button>
        <button
          type="button"
          className="button button-primary"
          /* Sólo después de una prueba en seco: es lo que convierte «subí algo y
             le di a un botón» en una decisión informada. */
          disabled={ocupado || !enSeco}
          onClick={() => {
            const categorias = revisar();
            if (categorias !== null) onInyectar(categorias);
          }}
        >
          <Upload size={15} aria-hidden="true" /> Inyectar
        </button>
        {!enSeco ? (
          <span className="field-help">Prueba en seco primero para habilitar la inyección.</span>
        ) : null}
      </div>

      {resumen !== null ? (
        <div className="categoria-import-resumen" role="status">
          <strong>
            {resumen.dryRun ? 'Prueba en seco' : 'Inyectado'}: {resumen.total} categoría(s)
          </strong>
          <div className="categoria-import-listas">
            <div>
              <span className="categoria-import-rotulo">Se crean ({resumen.created.length})</span>
              <p>{resumen.created.join(', ') || '—'}</p>
            </div>
            <div>
              <span className="categoria-import-rotulo">
                Se reemplazan ({resumen.updated.length})
              </span>
              <p>{resumen.updated.join(', ') || '—'}</p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * De qué formato es el texto pegado.
 *
 * Se mira el primer carácter y no la extensión, porque aquí puede no haber
 * archivo: quien pega un array lo pega con corchete, y quien pega un CSV empieza
 * por la cabecera. Al subir un archivo manda su extensión, que es más fiable.
 */
function detectar(texto: string): 'json' | 'csv' {
  return texto.trimStart().startsWith('[') || texto.trimStart().startsWith('{') ? 'json' : 'csv';
}
