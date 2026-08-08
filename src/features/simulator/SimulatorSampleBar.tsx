'use client';

import { useMutation } from '@tanstack/react-query';
import { Dices, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { z } from 'zod';
import { errorMessage } from '../../api/ApiError';
import { apiRequest } from '../../api/http-client';
import { Alert } from '../../components/Alert';
import {
  acceptedFileTypes,
  documentInput,
  fileInputLabel,
  fileToBase64,
  findDocumentSlot,
  isPdf,
  uploadLabel,
} from './document-input';
import { parseSampleFile, type ImportField, type ImportedCase } from './sample-import';

const sampleInputsSchema = z.object({
  seed: z.string(),
  kind: z.string(),
  cases: z.array(
    z.object({
      index: z.number(),
      kind: z.string(),
      mutation: z.string().optional(),
      input: z.record(z.unknown()),
    }),
  ),
});

type Kind = 'VALID' | 'BOUNDARY' | 'INVALID';

const KIND_LABEL: Record<Kind, string> = {
  VALID: 'válidos',
  BOUNDARY: 'en el límite',
  INVALID: 'inválidos',
};

interface Props {
  artifactCode: string;
  environmentCode: string;
  contract: ImportField[];
  /**
   * Lo que hay ahora en el formulario. Sólo se usa para NO perderlo al cargar un
   * documento, que aporta dos variables y no un caso completo.
   */
  current?: Record<string, unknown>;
  /**
   * El contrato del artefacto todavía no ha llegado.
   *
   * Sin esto, subir un archivo antes de que respondiera el contrato se
   * rechazaba con «este artefacto no declara ninguna variable de documento»,
   * que es **falso**: sí la declara, sólo que aún no se sabía. El defecto
   * dependía de la latencia, así que fallaba «a veces» y nunca en la máquina de
   * quien lo probaba.
   */
  contractLoading?: boolean;
  onLoad: (input: Record<string, unknown>) => void;
  /**
   * La tanda entera, para que la página pueda ejecutar TODOS los casos y
   * paginar sus resultados. `onLoad` sólo lleva el que se está editando.
   */
  onCases?: (cases: ImportedCase[]) => void;
  /**
   * Cuál de la tanda está el formulario editando.
   *
   * Sin esto, la página no puede saber en qué caso volcar lo que el analista
   * teclea, y al ejecutar mandaba la tanda tal como se generó —descartando cada
   * cambio hecho a mano—.
   */
  onActive?: (index: number) => void;
}

/**
 * Dos maneras de llenar el formulario sin teclear: pedirle valores al motor —que los
 * deriva del contrato REALMENTE desplegado, no de una plantilla del navegador— o subir un
 * JSON/CSV con datos propios.
 *
 * Las dos comparten el mismo carrusel de casos porque el analista hace lo mismo con
 * ambas: recorrerlos y cargar el que le interesa.
 */
export function SimulatorSampleBar({
  artifactCode,
  environmentCode,
  contract,
  current,
  contractLoading = false,
  onLoad,
  onCases,
  onActive,
}: Props) {
  const [kind, setKind] = useState<Kind>('VALID');
  const [count, setCount] = useState(3);
  const [cases, setCases] = useState<ImportedCase[]>([]);
  const [active, setActive] = useState(0);
  const [notice, setNotice] = useState<{ tone: 'info' | 'warning' | 'error'; text: string } | null>(
    null,
  );
  const fileInput = useRef<HTMLInputElement>(null);
  const ready = artifactCode.trim() !== '';

  function show(list: ImportedCase[], text: string, tone: 'info' | 'warning' = 'info') {
    setCases(list);
    setActive(0);
    setNotice({ tone, text });
    onCases?.(list);
    onActive?.(0);
    if (list.length) onLoad(list[0].input);
  }

  const generate = useMutation({
    mutationFn: () =>
      apiRequest(`/v1/simulations/${encodeURIComponent(artifactCode.trim())}/sample-inputs`, {
        method: 'POST',
        body: { environmentCode, kind, count },
        responseSchema: sampleInputsSchema,
      }),
    onSuccess: (data) => {
      show(
        data.cases.map((generated) => ({
          label: `Caso ${generated.index + 1}${generated.mutation ? ` · ${generated.mutation}` : ''}`,
          input: generated.input,
        })),
        `${data.cases.length} casos ${KIND_LABEL[kind]} generados desde el contrato desplegado · semilla ${data.seed}`,
      );
    },
    onError: (error) => setNotice({ tone: 'error', text: errorMessage(error) }),
  });

  async function importFile(file: File) {
    /*
     * Un PDF no se lee como texto: se codifica en base64 y se carga en la
     * variable que el contrato declara para el documento. No pasa por
     * `parseSampleFile` porque no hay filas que convertir —es un valor único—,
     * y el motor es quien lo interpreta.
     */
    const slot = findDocumentSlot(contract);
    if (isPdf(file)) {
      if (!slot) {
        /*
         * «No hay hueco documental» y «todavía no sé si lo hay» no son lo mismo.
         *
         * El contrato llega por red; mientras no está, `contract` viene vacío y
         * `findDocumentSlot` devuelve null para CUALQUIER artefacto. Decir aquí
         * que el artefacto no declara variable de documento era afirmar algo
         * falso a partir de no saberlo, y mandaba a subir un CSV a quien tenía
         * el archivo correcto en la mano.
         */
        setNotice(
          contractLoading
            ? {
                tone: 'warning',
                text: `Todavía se está leyendo el contrato de ${artifactCode}. Espera un momento y vuelve a subir ${file.name}.`,
              }
            : {
                tone: 'error',
                text: `${file.name}: este artefacto no declara ninguna variable de documento, así que un PDF no tiene dónde entrar. Sube JSON o CSV con los valores.`,
              },
        );
        return;
      }
      try {
        const base64 = await fileToBase64(file);
        /*
         * El documento se AÑADE a lo que ya hay, no lo reemplaza.
         *
         * Un PDF aporta dos variables —el contenido y el nombre— y no un caso
         * completo, así que sustituir el payload entero borraba en silencio lo
         * que el analista ya había rellenado. El síntoma era desconcertante:
         * subías el extracto y el motor contestaba «falta
         * cuota_solicitada_extracto» sobre un formulario que se veía completo.
         *
         * Las tandas generadas y los CSV sí reemplazan, y con razón: cada caso
         * suyo es un caso entero y mezclarlo con restos del anterior produciría
         * una entrada que nadie escribió.
         */
        show(
          [{ label: file.name, input: { ...current, ...documentInput(slot, file, base64) } }],
          `${file.name} · cargado en ${slot.contentCode}. El resto de variables del contrato las rellenas tú.`,
          'warning',
        );
      } catch (error) {
        setNotice({ tone: 'error', text: errorMessage(error) });
      }
      return;
    }

    const result = parseSampleFile(file.name, await file.text(), contract);
    if (result.error || !result.cases.length) {
      setNotice({ tone: 'error', text: result.error ?? 'El archivo no contiene valores.' });
      return;
    }
    const problems = [
      result.unknownKeys.length ? `fuera del contrato: ${result.unknownKeys.join(', ')}` : '',
      result.missingRequired.length
        ? `obligatorias que el archivo no trae: ${result.missingRequired.join(', ')}`
        : '',
    ].filter(Boolean);
    show(
      result.cases,
      `${file.name} · ${result.cases.length} casos${problems.length ? ` · ${problems.join(' · ')}` : ''}`,
      problems.length ? 'warning' : 'info',
    );
  }

  function pick(index: number) {
    setActive(index);
    onActive?.(index);
    onLoad(cases[index].input);
  }

  return (
    <div className="sample-bar" data-tutorial-id="simulator-samples">
      <div className="sample-bar-actions">
        <label className="field sample-bar-kind">
          <span>Valores de prueba</span>
          <select value={kind} onChange={(event) => setKind(event.target.value as Kind)}>
            <option value="VALID">Válidos</option>
            <option value="BOUNDARY">En el límite del contrato</option>
            <option value="INVALID">Inválidos (deben rechazarse)</option>
          </select>
        </label>
        <label className="field sample-bar-count">
          <span>Casos</span>
          <input
            type="number"
            min={1}
            max={20}
            value={count}
            onChange={(event) =>
              setCount(Math.min(20, Math.max(1, Number(event.target.value) || 1)))
            }
          />
        </label>
        <button
          type="button"
          className="button"
          disabled={!ready || generate.isPending}
          onClick={() => generate.mutate()}
        >
          <Dices size={16} /> {generate.isPending ? 'Generando…' : 'Generar valores'}
        </button>
        {/*
         * Deshabilitado mientras el contrato no ha llegado: hasta entonces no se
         * sabe qué formatos admite este artefacto ni dónde entra un documento,
         * y aceptar el archivo sólo servía para rechazarlo mal.
         */}
        <button
          type="button"
          className="button"
          onClick={() => fileInput.current?.click()}
          disabled={!ready || contractLoading}
          title={contractLoading ? 'Esperando el contrato del artefacto…' : undefined}
        >
          <Upload size={16} /> {contractLoading ? 'Leyendo el contrato…' : uploadLabel(contract)}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept={acceptedFileTypes(contract)}
          className="sr-only"
          aria-label={fileInputLabel(contract)}
          onChange={(event) => {
            const file = event.target.files?.[0];
            // Se limpia el input para que volver a elegir el MISMO archivo (tras editarlo)
            // dispare el evento de nuevo: si no, el navegador lo considera sin cambios.
            event.target.value = '';
            if (file) void importFile(file);
          }}
        />
      </div>

      {!ready ? (
        <small className="field-hint">Elige un artefacto para generar o importar valores.</small>
      ) : null}
      {notice ? <Alert tone={notice.tone}>{notice.text}</Alert> : null}
      {cases.length > 1 ? (
        <div className="sample-bar-cases" role="group" aria-label="Casos disponibles">
          {cases.map((sample, index) => (
            <button
              key={sample.label}
              type="button"
              className="sample-case-chip"
              aria-pressed={index === active}
              onClick={() => pick(index)}
            >
              {sample.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
