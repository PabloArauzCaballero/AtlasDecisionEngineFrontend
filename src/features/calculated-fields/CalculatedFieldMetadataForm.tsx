'use client';

import { useState } from 'react';
import { Field } from '../../components/Field';

export interface FieldMetadata {
  fieldCode: string;
  name: string;
  description: string;
  rationale: string;
  category: string;
  ownerTeam: string;
}

interface Props {
  onCancel: () => void;
  onNext: (metadata: FieldMetadata) => void;
}

/**
 * Paso 1 del alta: identidad y gobierno del campo calculado.
 *
 * Todo empieza vacío a propósito: una categoría o un equipo prerrellenados se
 * envían tal cual si nadie los mira y quedan en el catálogo como si alguien los
 * hubiera elegido.
 */
export function CalculatedFieldMetadataForm({ onCancel, onNext }: Props) {
  const [form, setForm] = useState<FieldMetadata>({
    fieldCode: '',
    name: '',
    description: '',
    rationale: '',
    category: '',
    ownerTeam: '',
  });
  const patch = (change: Partial<FieldMetadata>) =>
    setForm((current) => ({ ...current, ...change }));

  return (
    <form
      className="constraint-grid"
      onSubmit={(event) => {
        event.preventDefault();
        onNext(form);
      }}
    >
      <p className="field-hint constraint-wide">
        Paso 1 de 2 — identidad del campo. Después definirás qué calcula.
      </p>
      <Field
        className="constraint-field"
        label="Código técnico"
        tooltip="Identificador único del campo en minúsculas, números y guion bajo. Ej.: debt_to_income."
      >
        <input
          required
          pattern="[a-z][a-z0-9_]{2,119}"
          title="Minúsculas, números y guion bajo"
          value={form.fieldCode}
          onChange={(event) => patch({ fieldCode: event.target.value })}
        />
      </Field>
      <Field
        className="constraint-field"
        label="Nombre visible"
        tooltip="Nombre legible del campo calculado en el catálogo."
      >
        <input
          required
          value={form.name}
          onChange={(event) => patch({ name: event.target.value })}
        />
      </Field>
      <Field
        className="constraint-field"
        label="Categoría"
        tooltip="Grupo del catálogo en el que se clasifica el campo."
      >
        <input
          required
          value={form.category}
          onChange={(event) => patch({ category: event.target.value })}
        />
      </Field>
      <Field
        className="constraint-field"
        label="Equipo responsable"
        tooltip="Equipo que responde por la fórmula y sus cambios."
      >
        <input
          required
          value={form.ownerTeam}
          onChange={(event) => patch({ ownerTeam: event.target.value })}
        />
      </Field>
      <Field
        className="constraint-field constraint-wide"
        label="Descripción"
        tooltip="Qué calcula el campo, en lenguaje de negocio."
      >
        <textarea
          required
          rows={2}
          value={form.description}
          onChange={(event) => patch({ description: event.target.value })}
        />
      </Field>
      <Field
        className="constraint-field constraint-wide"
        label="Justificación funcional: ¿por qué existe este cálculo?"
        tooltip="Por qué hace falta este cálculo; lo lee quien aprueba la versión."
      >
        <textarea
          required
          rows={2}
          value={form.rationale}
          onChange={(event) => patch({ rationale: event.target.value })}
        />
      </Field>
      <div className="constraint-wide panel-actions">
        <button type="button" className="button" onClick={onCancel}>
          Cancelar
        </button>
        <button className="button button-primary" type="submit">
          Siguiente: qué calcula
        </button>
      </div>
    </form>
  );
}
