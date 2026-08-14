'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Panel } from '../../components/Panel';
import { ArtifactBindingPanel } from './ArtifactBindingPanel';
import { useNotifications } from '../../notifications/useNotifications';
import { saveFile } from './save-file';
import { SchemaDrivenForm, type FieldValues } from './SchemaDrivenForm';
import {
  downloadGeneratedDocument,
  downloadTemplatePreview,
  fetchPdfTemplateSchema,
  fetchPdfTemplates,
  validateDocumentPayload,
} from './documents.api';
import type { PayloadIssue } from './document-types';

/**
 * Consola del generador documental: elegir un documento, rellenarlo y bajarlo.
 *
 * Todo lo que se ve aquí lo dicta el motor. La lista de documentos, los campos
 * de cada uno, sus tipos, cuáles son obligatorios y qué valores admite un enum
 * salen de `/pdf/templates` y `/pdf/templates/:id/schema`; el portal no guarda
 * ni una copia. Es lo que permite que añadir un documento allí no exija tocar
 * nada aquí — y lo que impide el desfase clásico: una pantalla que pide campos
 * que ya no existen.
 *
 * No pinta cabecera: vive dentro de la pestaña «Consola» de `WorkersPage`.
 */
export function DocumentGeneratorConsole() {
  const { notify } = useNotifications();
  const [templateId, setTemplateId] = useState('');
  const [values, setValues] = useState<FieldValues>({});
  const [issues, setIssues] = useState<readonly PayloadIssue[]>([]);

  const templates = useQuery({
    queryKey: ['pdf-templates'],
    queryFn: ({ signal }) => fetchPdfTemplates(signal),
  });

  const selected = templateId || templates.data?.[0]?.id || '';

  const schema = useQuery({
    queryKey: ['pdf-template-schema', selected],
    queryFn: ({ signal }) => fetchPdfTemplateSchema(selected, undefined, signal),
    enabled: selected !== '',
  });

  /**
   * Al cambiar de documento se siembra el formulario con el EJEMPLO del propio
   * template, no en blanco.
   *
   * Un formulario vacío con doce campos obliga a adivinar la forma de cada uno;
   * con el ejemplo delante se ve qué espera cada campo y se cambia lo que
   * interese. El ejemplo lo publica el motor y está validado contra el mismo
   * contrato, así que nunca siembra algo que se vaya a rechazar.
   */
  useEffect(() => {
    if (!schema.data) return;
    const example = schema.data.example;
    setValues(example && typeof example === 'object' ? { ...(example as FieldValues) } : {});
    setIssues([]);
  }, [schema.data]);

  const issuesByField = useMemo(() => {
    const map: Record<string, string> = {};
    for (const issue of issues) {
      // Sólo el primer segmento: el problema de `movimientos.3.importe` se
      // señala en el control de `movimientos`, que es el que se puede editar.
      const root = issue.field.split('.')[0];
      if (!map[root])
        map[root] = `${issue.problem}${issue.expected ? ` — se esperaba ${issue.expected}` : ''}`;
    }
    return map;
  }, [issues]);

  const generate = useMutation({
    mutationFn: async () => {
      // Se valida primero contra el motor: un rechazo cuesta una petición barata
      // en vez de un renderizado entero, y devuelve la ruta exacta del campo.
      const verdict = await validateDocumentPayload(selected, values);
      if (!verdict.valid) {
        setIssues(verdict.issues);
        throw new Error(
          `El documento no se puede generar: ${verdict.issues.length} campo(s) con problemas.`,
        );
      }
      setIssues([]);
      return downloadGeneratedDocument({ templateId: selected, payload: values });
    },
    onSuccess: (file) => {
      saveFile(file.blob, file.fileName);
      notify({
        tone: 'success',
        title: 'Documento generado',
        description: `Se descargó ${file.fileName}.`,
      });
    },
  });

  const preview = useMutation({
    mutationFn: () => downloadTemplatePreview(selected),
    onSuccess: (file) => {
      saveFile(file.blob, file.fileName);
      notify({
        tone: 'success',
        title: 'Vista previa lista',
        description: 'Generada con los datos de ejemplo que publica el propio template.',
      });
    },
  });

  const current = templates.data?.find((template) => template.id === selected);
  const busy = generate.isPending || preview.isPending;

  return (
    <>
      <Panel
        title="Documento"
        meta="El catálogo lo publica el motor. Cada documento declara qué datos necesita."
      >
        {templates.isLoading ? <p>Cargando el catálogo de documentos…</p> : null}
        {templates.data?.length === 0 ? (
          <p>El motor no publica ningún documento en este despliegue.</p>
        ) : null}

        <div className="doc-picker">
          <label className="doc-form__label" htmlFor="doc-template">
            Plantilla
          </label>
          <select
            id="doc-template"
            value={selected}
            disabled={busy || templates.isLoading}
            onChange={(event) => setTemplateId(event.target.value)}
          >
            {(templates.data ?? []).map((template) => (
              <option key={template.id} value={template.id}>
                {template.title} · {template.id}@{template.version}
              </option>
            ))}
          </select>
        </div>

        {current ? (
          <>
            <p className="doc-picker__description">{current.description}</p>
            {current.deprecated ? (
              <p className="doc-picker__deprecated" role="status">
                Versión obsoleta desde {current.deprecated.since}: {current.deprecated.reason}
                {current.deprecated.replacedBy ? ` Use ${current.deprecated.replacedBy}.` : ''}
              </p>
            ) : null}
          </>
        ) : null}
      </Panel>

      {/* Entre elegir el documento y rellenarlo: es donde se decide de dónde
          salen los datos, y por tanto si esta pareja documento/artefacto sirve. */}
      {selected ? (
        <ArtifactBindingPanel
          templateId={selected}
          disabled={busy}
          onSample={(valores) => {
            // Se FUNDE sobre lo que ya hay, no se sustituye. Un artefacto declara
            // ejemplo sólo para algunos campos, y reemplazar el formulario entero
            // borraba lo demás — incluido lo que el usuario acababa de escribir.
            setValues((previos) => ({ ...previos, ...valores }));
            setIssues([]);
          }}
        />
      ) : null}

      <Panel
        title="Datos"
        meta="Los campos salen del contrato que publica el motor; el formulario no los conoce de antemano."
      >
        {schema.isLoading ? <p>Cargando el contrato del documento…</p> : null}
        {schema.data ? (
          <SchemaDrivenForm
            fields={schema.data.fields}
            values={values}
            onChange={setValues}
            issuesByField={issuesByField}
            disabled={busy}
          />
        ) : null}

        <div className="doc-actions">
          <button
            type="button"
            className="button button--primary"
            disabled={busy || !selected}
            onClick={() => generate.mutate()}
          >
            {generate.isPending ? 'Generando…' : 'Generar y descargar'}
          </button>
          <button
            type="button"
            className="button"
            disabled={busy || !selected}
            onClick={() => preview.mutate()}
          >
            {preview.isPending ? 'Preparando…' : 'Vista previa con datos de ejemplo'}
          </button>
        </div>

        {issues.length > 0 ? (
          <div className="doc-issues" role="alert">
            <p className="doc-issues__title">El motor rechazó estos campos:</p>
            <ul>
              {issues.map((issue) => (
                <li key={`${issue.field}-${issue.problem}`}>
                  <code>{issue.field}</code> — {issue.problem}
                  {issue.expected ? ` (se esperaba ${issue.expected})` : ''}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Panel>
    </>
  );
}
