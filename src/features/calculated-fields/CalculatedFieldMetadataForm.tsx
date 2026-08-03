'use client';

import { useState } from 'react';

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
      <label className="constraint-field">
        <span>Código técnico</span>
        <input
          required
          pattern="[a-z][a-z0-9_]{2,119}"
          title="Minúsculas, números y guion bajo"
          value={form.fieldCode}
          onChange={(event) => patch({ fieldCode: event.target.value })}
        />
      </label>
      <label className="constraint-field">
        <span>Nombre visible</span>
        <input
          required
          value={form.name}
          onChange={(event) => patch({ name: event.target.value })}
        />
      </label>
      <label className="constraint-field">
        <span>Categoría</span>
        <input
          required
          value={form.category}
          onChange={(event) => patch({ category: event.target.value })}
        />
      </label>
      <label className="constraint-field">
        <span>Equipo responsable</span>
        <input
          required
          value={form.ownerTeam}
          onChange={(event) => patch({ ownerTeam: event.target.value })}
        />
      </label>
      <label className="constraint-field constraint-wide">
        <span>Descripción</span>
        <textarea
          required
          rows={2}
          value={form.description}
          onChange={(event) => patch({ description: event.target.value })}
        />
      </label>
      <label className="constraint-field constraint-wide">
        <span>Justificación funcional: ¿por qué existe este cálculo?</span>
        <textarea
          required
          rows={2}
          value={form.rationale}
          onChange={(event) => patch({ rationale: event.target.value })}
        />
      </label>
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
