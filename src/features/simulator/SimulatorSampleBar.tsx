'use client';

import { useMutation } from '@tanstack/react-query';
import { Dices, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { z } from 'zod';
import { errorMessage } from '../../api/ApiError';
import { apiRequest } from '../../api/http-client';
import { Alert } from '../../components/Alert';
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
  onLoad: (input: Record<string, unknown>) => void;
}

/**
 * Dos maneras de llenar el formulario sin teclear: pedirle valores al motor —que los
 * deriva del contrato REALMENTE desplegado, no de una plantilla del navegador— o subir un
 * JSON/CSV con datos propios.
 *
 * Las dos comparten el mismo carrusel de casos porque el analista hace lo mismo con
 * ambas: recorrerlos y cargar el que le interesa.
 */
export function SimulatorSampleBar({ artifactCode, environmentCode, contract, onLoad }: Props) {
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
        <button
          type="button"
          className="button"
          onClick={() => fileInput.current?.click()}
          disabled={!ready}
        >
          <Upload size={16} /> Subir JSON o CSV
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,.csv,application/json,text/csv"
          className="sr-only"
          aria-label="Subir archivo JSON o CSV con valores de prueba"
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
