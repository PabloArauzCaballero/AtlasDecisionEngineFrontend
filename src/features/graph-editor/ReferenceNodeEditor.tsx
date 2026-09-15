import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Link2, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { errorMessage } from '../../api/ApiError';
import { ConfirmButton } from '../../components/ConfirmButton';
import { PickerSelect } from '../../components/PickerSelect';
import { NavLink } from '../../navigation/NavLink';
import { useNotifications } from '../../notifications/useNotifications';
import { display, type UnknownRecord } from '../../utils/records';
import {
  buildReferenceBody,
  emptyReferenceForm,
  outputAssignmentsOf,
  referenceErrors,
  type ReferenceFormState,
} from './reference-authoring';
import { ReferencePolicyFields } from './ReferencePolicyFields';
import { createReference, deleteReference, listReferences } from './references.api';
import { OptionSelect } from '../../components/OptionSelect';
import { ON_ERROR_POLICY_HELP, REFERENCE_INPUT_SOURCE_HELP } from './graph-node-help';
import { closedOptions, inputOption } from './graph-editor-help';
import { Field } from '../../components/Field';

interface Props {
  versionId: string;
  nodeKey: string;
  inputs: UnknownRecord[];
  outputs: UnknownRecord[];
  onOutputAssignments: (
    assignments: Array<{ outputCode: string; childOutputCode: string }>,
  ) => void;
}

export function ReferenceNodeEditor({
  versionId,
  nodeKey,
  inputs,
  outputs,
  onOutputAssignments,
}: Props) {
  const client = useQueryClient();
  const { notify } = useNotifications();
  const [form, setForm] = useState<ReferenceFormState>(emptyReferenceForm);

  const existing = useQuery({
    queryKey: ['references', versionId],
    queryFn: ({ signal }) => listReferences(versionId, signal),
    enabled: Boolean(versionId),
  });
  const nodeRefs = (existing.data ?? []).filter((ref) => display(ref, 'nodeKey') === nodeKey);

  const save = useMutation({
    mutationFn: () => createReference(versionId, buildReferenceBody(nodeKey, form)),
    onSuccess: () => {
      onOutputAssignments(outputAssignmentsOf(form));
      // `void`: el refresco se lanza y no se espera a propósito. Devolverlo
      // retrasaría el `isSuccess` de la mutación hasta que la lista volviera del
      // motor, y el aviso de abajo llegaría tarde sin ninguna razón.
      void client.invalidateQueries({ queryKey: ['references', versionId] });
      notify({
        tone: 'success',
        title: 'Referencia vinculada',
        description: 'Guarda el grafo para persistir el mapeo de salida del nodo.',
      });
      setForm(emptyReferenceForm());
    },
  });
  const remove = useMutation({
    mutationFn: (referenceId: string) => deleteReference(versionId, referenceId),
    onSuccess: () => client.invalidateQueries({ queryKey: ['references', versionId] }),
  });

  const errors = referenceErrors(nodeKey, form);
  const patch = (next: Partial<ReferenceFormState>) => setForm((prev) => ({ ...prev, ...next }));
  const setOutput = (outputCode: string, childOutputCode: string) =>
    patch({ outputMap: { ...form.outputMap, [outputCode]: childOutputCode } });
  const setInput = (index: number, next: Partial<ReferenceFormState['inputMappings'][number]>) =>
    patch({
      inputMappings: form.inputMappings.map((entry, i) =>
        i === index ? { ...entry, ...next } : entry,
      ),
    });

  if (!versionId) {
    return <p className="field-hint">Carga una versión para vincular otro algoritmo.</p>;
  }

  return (
    <section className="reference-editor">
      <p className="field-hint">
        Ejecuta otro algoritmo dentro de este nodo: alimenta sus entradas desde este flujo y trae
        sus salidas a tus variables de resultado.
      </p>

      <PickerSelect
        label="Algoritmo (artefacto) a referenciar"
        value={form.childArtifactId}
        onChange={(value) => patch({ childArtifactId: value })}
        endpoint="/v1/views/pickers/artifacts"
        queryKey="artifacts"
        mapOption={(row) => ({
          value: display(row, 'id'),
          label: `${display(row, 'artifactCode')} · ${display(row, 'name')}`,
        })}
      />
      <PickerSelect
        label="Versión del algoritmo"
        value={form.childArtifactVersionId}
        onChange={(value) => patch({ childArtifactVersionId: value })}
        endpoint="/v1/views/pickers/artifact-versions"
        queryKey="artifact-versions"
        mapOption={(row) => ({
          value: display(row, 'id'),
          label: `${display(row, 'artifactCode')} v${display(row, 'semanticVersion')} · ${display(row, 'status')}`,
        })}
      />

      <h4>Salidas: del algoritmo → a este flujo</h4>
      {outputs.length ? (
        outputs.map((output) => {
          const code = display(output, 'code');
          return (
            <Field
              className="reference-output-row"
              key={code}
              label={
                <>
                  {code} <small>{display(output, 'dataType')}</small>
                </>
              }
              tooltip={`Código de la salida del algoritmo referenciado que se copia en «${code}». Ej.: decision.`}
            >
              <input
                value={form.outputMap[code] ?? ''}
                placeholder="código de salida del hijo"
                onChange={(event) => setOutput(code, event.target.value)}
              />
            </Field>
          );
        })
      ) : (
        <p className="field-hint">Declara variables de salida arriba para poder mapearlas.</p>
      )}

      <div className="reference-inputs-heading">
        <h4>Entradas del algoritmo referenciado</h4>
        <button
          type="button"
          className="button"
          onClick={() =>
            patch({
              inputMappings: [
                ...form.inputMappings,
                {
                  childVariableCode: '',
                  source: 'VARIABLE',
                  path: inputs[0] ? display(inputs[0], 'code') : '',
                },
              ],
            })
          }
        >
          <Plus size={13} /> Mapear entrada
        </button>
      </div>
      {form.inputMappings.map((entry, index) => (
        <div className="reference-input-row" key={index}>
          <input
            value={entry.childVariableCode}
            placeholder="variable del hijo"
            onChange={(event) => setInput(index, { childVariableCode: event.target.value })}
          />
          <OptionSelect
            name="referenceInputSource"
            value={entry.source}
            onChange={(value) => setInput(index, { source: value as 'VARIABLE' | 'LITERAL' })}
            options={closedOptions(
              [
                { value: 'VARIABLE', label: 'Desde variable' },
                { value: 'LITERAL', label: 'Valor fijo' },
              ],
              REFERENCE_INPUT_SOURCE_HELP,
            )}
          />
          {entry.source === 'VARIABLE' ? (
            <OptionSelect
              name="referenceInputPath"
              value={entry.path ?? ''}
              onChange={(value) => setInput(index, { path: value })}
              placeholder="Elegir…"
              options={inputs.map(inputOption)}
            />
          ) : (
            <input
              placeholder="valor"
              onChange={(event) => setInput(index, { value: event.target.value })}
            />
          )}
          <ConfirmButton
            className="icon-button"
            label="Quitar entrada"
            title="¿Quitar este mapeo de entrada?"
            confirmLabel="Quitar el mapeo"
            description={
              <p>
                El algoritmo referenciado dejará de recibir{' '}
                <b>{entry.childVariableCode || 'esta variable'}</b>. Si es obligatoria allí, la
                llamada fallará.
              </p>
            }
            onConfirm={() =>
              patch({ inputMappings: form.inputMappings.filter((_, i) => i !== index) })
            }
          >
            <Trash2 size={13} />
          </ConfirmButton>
        </div>
      ))}

      <Field
        label="Si el algoritmo referenciado falla"
        tooltip="Qué hace esta decisión cuando la subdecisión da error o no responde a tiempo."
      >
        <OptionSelect
          name="onErrorPolicy"
          value={form.onErrorPolicy}
          onChange={(value) =>
            patch({ onErrorPolicy: value as ReferenceFormState['onErrorPolicy'] })
          }
          options={closedOptions(
            [
              { value: 'FAIL', label: 'Fallar la decisión (fail-closed)' },
              { value: 'FALLBACK', label: 'Usar salida de reserva' },
              { value: 'SKIP', label: 'Omitir la referencia' },
            ],
            ON_ERROR_POLICY_HELP,
          )}
        />
      </Field>

      <ReferencePolicyFields form={form} onPatch={patch} />

      {errors.length ? (
        <ul className="reference-errors">
          {[...new Set(errors)].map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}
      {save.isError ? <small className="field-error">{errorMessage(save.error)}</small> : null}
      <button
        type="button"
        className="button button-primary full-width"
        disabled={Boolean(errors.length) || save.isPending}
        onClick={() => save.mutate()}
      >
        <Link2 size={14} /> Vincular referencia
      </button>

      {nodeRefs.length ? (
        <div className="reference-existing">
          <h4>Referencias vinculadas a este nodo</h4>
          {nodeRefs.map((ref) => (
            <div className="reference-existing-row" key={display(ref, 'id')}>
              <span className="mono">
                {display(ref, 'childArtifactVersionId', 'childArtifactId')}
              </span>
              <NavLink
                className="reference-open"
                href={`/artifact-versions/${display(ref, 'childArtifactVersionId')}/graph`}
              >
                <ExternalLink size={12} /> Abrir algoritmo
              </NavLink>
              <ConfirmButton
                className="icon-button"
                label="Quitar referencia"
                title="¿Quitar la referencia a este algoritmo?"
                confirmLabel="Quitar la referencia"
                disabled={remove.isPending}
                description={
                  <p>
                    Este paso deja de llamar al algoritmo{' '}
                    <b>{display(ref, 'childArtifactVersionId', 'childArtifactId')}</b>, y el
                    resultado que traía dejará de estar disponible para los pasos siguientes. Se
                    borra en el motor al confirmar, no al guardar el grafo.
                  </p>
                }
                onConfirm={() => remove.mutate(display(ref, 'id'))}
              >
                <Trash2 size={13} />
              </ConfirmButton>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
