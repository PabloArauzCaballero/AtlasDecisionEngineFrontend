'use client';

import { useState, type FormEvent } from 'react';
import { CatalogInput } from '../../components/CatalogInput';
import { display, type UnknownRecord } from '../../utils/records';
import { OptionSelect } from '../../components/OptionSelect';
import { DATA_TYPE_HELP_ANY } from '../../contracts/contract-help';
import { Field } from '../../components/Field';

export interface CatalogVariableDraft {
  variableCode: string;
  canonicalName: string;
  businessDescription: string;
  dataClassification: string;
  ownerTeam: string;
  dataType: string;
}

interface Props {
  pending: boolean;
  error?: string | null;
  onSubmit: (draft: CatalogVariableDraft) => void;
}

const DATA_TYPES = ['NUMBER', 'INTEGER', 'STRING', 'BOOLEAN', 'OBJECT', 'ARRAY'];

/** Igual que en el alta del catálogo: los valores definidos salen del motor. */
const optionEndpoint = (group: string) => `/v1/views/options?group=${group}`;
const toOption = (row: UnknownRecord) => {
  const value = display(row, 'value');
  return value === '—' ? null : { value, label: display(row, 'label', 'value') };
};

/**
 * Alta de una variable del catálogo desde el editor de grafo.
 *
 * Pide todo lo que el motor exige. Antes tres campos los rellenaba el propio
 * portal —clasificación `INTERNAL`, equipo `DECISION_ENGINE` y una descripción
 * generada a partir del nombre— y eso es lo peor que puede hacer una
 * herramienta de gobierno: el catálogo existe para registrar de quién es cada
 * dato y cómo de sensible es, y quedaba sellado con una respuesta que nadie dio.
 *
 * Equipo y clasificación se eligen de `/v1/views/options`, la misma vista de
 * opciones que usa el alta del catálogo, así que tampoco se inventan aquí; y
 * `CatalogInput` deja escribir un valor nuevo cuando hace falta crearlo.
 */
export function CatalogVariableForm({ pending, error, onSubmit }: Props) {
  const [draft, setDraft] = useState<CatalogVariableDraft>({
    variableCode: '',
    canonicalName: '',
    businessDescription: '',
    dataClassification: '',
    ownerTeam: '',
    dataType: 'NUMBER',
  });
  const patch = (change: Partial<CatalogVariableDraft>) =>
    setDraft((current) => ({ ...current, ...change }));

  return (
    <form
      className="output-create-form"
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        onSubmit(draft);
      }}
    >
      <Field
        label="Código"
        tooltip="Identificador técnico único de la variable en el catálogo. Ej.: score_riesgo. No cambia entre versiones."
      >
        <input
          required
          pattern="[a-zA-Z][a-zA-Z0-9_.-]+"
          value={draft.variableCode}
          placeholder="score_riesgo"
          onChange={(event) => patch({ variableCode: event.target.value })}
        />
      </Field>
      <Field
        label="Nombre"
        tooltip="Nombre legible que verán las personas en pantallas y trazas. Ej.: «Score de riesgo»."
      >
        <input
          required
          value={draft.canonicalName}
          placeholder="Score de riesgo"
          onChange={(event) => patch({ canonicalName: event.target.value })}
        />
      </Field>
      <Field
        label="Tipo"
        tooltip="Qué clase de valor devuelve; decide cómo se compara y valida en otros algoritmos."
      >
        <OptionSelect
          name="dataType"
          value={draft.dataType}
          onChange={(value) => patch({ dataType: value })}
          options={DATA_TYPES.map((type) => ({
            value: type,
            label: type,
            description: DATA_TYPE_HELP_ANY[type],
          }))}
        />
      </Field>
      <CatalogInput
        required
        label="Equipo responsable"
        help="Equipo que mantiene esta variable y responde por su calidad."
        value={draft.ownerTeam}
        onChange={(value) => patch({ ownerTeam: value })}
        endpoint={optionEndpoint('ownerTeam')}
        queryKey="graph-variable-owner-team"
        mapOption={toOption}
      />
      <CatalogInput
        required
        label="Clasificación de datos"
        help="Nivel de confidencialidad. Define los controles de acceso que el motor aplica al dato."
        value={draft.dataClassification}
        onChange={(value) => patch({ dataClassification: value })}
        endpoint={optionEndpoint('dataClassification')}
        queryKey="graph-variable-classification"
        mapOption={toOption}
      />
      <Field
        className="output-create-wide"
        label="Para qué sirve"
        tooltip="Qué representa la variable y cuándo usarla, para quien la encuentre en el catálogo."
      >
        <textarea
          required
          rows={2}
          value={draft.businessDescription}
          placeholder="Qué representa este dato y por qué la decisión lo necesita."
          onChange={(event) => patch({ businessDescription: event.target.value })}
        />
      </Field>
      <button className="button button-primary" disabled={pending} type="submit">
        {pending ? 'Guardando…' : 'Guardar y elegir'}
      </button>
      {error ? <small className="field-error">{error}</small> : null}
    </form>
  );
}
