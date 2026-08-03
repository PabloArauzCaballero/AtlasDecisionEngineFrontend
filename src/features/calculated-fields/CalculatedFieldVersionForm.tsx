'use client';

import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../api/http-client';
import { asRecord, asRows, type UnknownRecord } from '../../utils/records';
import { CalculatedFieldInputsForm } from './CalculatedFieldInputsForm';
import { CodeImplementationEditor } from './CodeImplementationEditor';
import { OperationBuilder } from './OperationBuilder';
import { ReturnContractForm } from './ReturnContractForm';
import {
  IMPLEMENTATION_KINDS,
  IMPLEMENTATION_LABELS,
  type CalculatedFieldDraft,
  type ImplementationKind,
} from './calculated-field.types';

interface Props {
  draft: CalculatedFieldDraft;
  onChange: (draft: CalculatedFieldDraft) => void;
}

/** Formulario completo de una versión de campo calculado (§5.2, §5.3, §5.4, §6). */
export function CalculatedFieldVersionForm({ draft, onChange }: Props) {
  const patch = (change: Partial<CalculatedFieldDraft>) => onChange({ ...draft, ...change });

  const catalog = useQuery({
    queryKey: ['calculated-field-operations'],
    queryFn: ({ signal }) =>
      apiRequest<UnknownRecord>('/v1/calculated-fields/operations', { signal }),
    enabled: draft.implementationKind === 'OPERATION',
  });
  const operations = asRows(asRecord(catalog.data).operations);

  return (
    <div className="calculated-field-form">
      <fieldset>
        <legend>Modalidad de implementación</legend>
        <div className="implementation-choices">
          {IMPLEMENTATION_KINDS.map((kind) => (
            <label key={kind} className={draft.implementationKind === kind ? 'is-active' : ''}>
              <input
                type="radio"
                name="implementationKind"
                value={kind}
                checked={draft.implementationKind === kind}
                onChange={() =>
                  patch({
                    implementationKind: kind as ImplementationKind,
                    // Cambiar de modalidad limpia la otra: guardar las dos a la vez es un
                    // contrato ambiguo y el backend lo rechaza.
                    operation: kind === 'OPERATION' ? draft.operation : undefined,
                    sourceCode: kind === 'OPERATION' ? undefined : (draft.sourceCode ?? ''),
                    libraryIds: kind === 'OPERATION' ? [] : draft.libraryIds,
                  })
                }
              />
              {IMPLEMENTATION_LABELS[kind]}
            </label>
          ))}
        </div>
        <small className="field-hint">
          El constructor visual solo puede invocar operaciones de un catálogo cerrado; es la opción
          recomendada cuando alcanza.
        </small>
      </fieldset>

      <fieldset>
        <legend>Entradas</legend>
        <CalculatedFieldInputsForm inputs={draft.inputs} onChange={(inputs) => patch({ inputs })} />
      </fieldset>

      <fieldset>
        <legend>Qué devuelve</legend>
        <ReturnContractForm value={draft.returns} onChange={(returns) => patch({ returns })} />
      </fieldset>

      <fieldset>
        <legend>Implementación</legend>
        {draft.implementationKind === 'OPERATION' ? (
          <OperationBuilder
            operations={operations}
            inputs={draft.inputs}
            value={draft.operation}
            onChange={(operation) => patch({ operation })}
          />
        ) : (
          <CodeImplementationEditor
            language={draft.implementationKind}
            inputs={draft.inputs}
            sourceCode={draft.sourceCode ?? ''}
            libraryIds={draft.libraryIds}
            environment={draft.environment}
            onChangeSource={(sourceCode) => patch({ sourceCode })}
            onChangeLibraries={(libraryIds) => patch({ libraryIds })}
          />
        )}
      </fieldset>

      <fieldset>
        <legend>Comentarios</legend>
        <small className="field-hint">
          Viven fuera del código: documentan el cálculo sin gastar ninguna de las tres líneas
          ejecutables.
        </small>
        <div className="constraint-grid">
          <CommentField
            label="Descripción general"
            value={draft.comments.overview ?? ''}
            onChange={(overview) => patch({ comments: { ...draft.comments, overview } })}
          />
          <CommentField
            label="Explicación de las entradas"
            value={draft.comments.inputsExplained ?? ''}
            onChange={(inputsExplained) =>
              patch({ comments: { ...draft.comments, inputsExplained } })
            }
          />
          <CommentField
            label="Explicación de la salida"
            value={draft.comments.outputExplained ?? ''}
            onChange={(outputExplained) =>
              patch({ comments: { ...draft.comments, outputExplained } })
            }
          />
          <CommentField
            label="Supuestos (uno por línea)"
            value={(draft.comments.assumptions ?? []).join('\n')}
            onChange={(text) =>
              patch({ comments: { ...draft.comments, assumptions: splitLines(text) } })
            }
          />
          <CommentField
            label="Limitaciones (una por línea)"
            value={(draft.comments.limitations ?? []).join('\n')}
            onChange={(text) =>
              patch({ comments: { ...draft.comments, limitations: splitLines(text) } })
            }
          />
          <CommentField
            label="Ejemplo"
            value={draft.comments.example ?? ''}
            onChange={(example) => patch({ comments: { ...draft.comments, example } })}
          />
        </div>
      </fieldset>
    </div>
  );
}

function CommentField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="constraint-field constraint-wide">
      <span>{label}</span>
      <textarea rows={2} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function splitLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}
