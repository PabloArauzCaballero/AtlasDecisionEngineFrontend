'use client';

import { useState } from 'react';
import { Panel } from '../../components/Panel';
import { useNotifications } from '../../notifications/useNotifications';
import { useRecordDossier } from './risk-governance.api';
import { Field } from '../../components/Field';

/**
 * Expediente del modelo: quién lo validó, con qué límites y cuándo toca revisarlo.
 *
 * El material estaba disperso —evidencias de aprobación, objetivos, requisitos de política— y le
 * faltaba lo único que lo convierte en un control vivo: VENCIMIENTO. Una validación sin fecha de
 * caducidad se transforma sola en un papel de hace tres años que nadie vuelve a mirar.
 *
 * Dos cosas que la pantalla dice y conviene entender:
 *
 *  - **La validación es independiente.** El motor rechaza que la firme quien creó la versión. Que
 *    la firme el autor la convierte en un trámite, y un trámite no detecta nada.
 *  - **Vencer no bloquea la ejecución.** Cortar el crédito de una financiera por un papel vencido
 *    es peor que el papel vencido. Se marca, se ve, y no se puede ignorar en silencio — que es
 *    distinto de no poder ignorarlo.
 */
export function ModelDossierPanel() {
  const [form, setForm] = useState({
    artifactVersionId: '',
    validatedBy: '',
    validatedAt: today(),
    revalidationDueAt: inOneYear(),
    limitationsNotes: '',
  });
  const record = useRecordDossier();
  const { notify } = useNotifications();

  const submit = async () => {
    await record.mutateAsync({
      artifactVersionId: form.artifactVersionId.trim(),
      validatedBy: form.validatedBy.trim(),
      validatedAt: `${form.validatedAt}T00:00:00.000Z`,
      revalidationDueAt: `${form.revalidationDueAt}T00:00:00.000Z`,
      limitationsNotes: form.limitationsNotes.trim() || undefined,
    });
    notify({
      tone: 'success',
      title: 'Expediente registrado',
      description: `Esta versión vuelve a revisión el ${new Date(form.revalidationDueAt).toLocaleDateString()}.`,
    });
  };

  const complete =
    form.artifactVersionId.trim() !== '' &&
    form.validatedBy.trim() !== '' &&
    form.revalidationDueAt > form.validatedAt;

  return (
    <Panel
      title="Expediente del modelo"
      meta="la firma la pone quien validó, no quien escribió"
      tutorialId="risk-dossier"
    >
      <div className="quality-form-grid">
        <Field
          label="Versión del algoritmo"
          tooltip="Identificador de la versión del algoritmo cuyo expediente se registra. Ej.: 4001."
        >
          <input
            value={form.artifactVersionId}
            placeholder="4001"
            onChange={(event) => setForm({ ...form, artifactVersionId: event.target.value })}
          />
        </Field>
        <Field
          label="Quién validó (independiente del autor)"
          tooltip="Persona que validó el modelo sin haberlo construido."
        >
          <input
            value={form.validatedBy}
            placeholder="validacion.independiente@atlas"
            onChange={(event) => setForm({ ...form, validatedBy: event.target.value })}
          />
        </Field>
        <Field label="Fecha de validación" tooltip="Día en que se validó el modelo.">
          <input
            type="date"
            value={form.validatedAt}
            onChange={(event) => setForm({ ...form, validatedAt: event.target.value })}
          />
        </Field>
        <Field label="Revalidar antes de" tooltip="Fecha límite para volver a validar el modelo.">
          <input
            type="date"
            value={form.revalidationDueAt}
            onChange={(event) => setForm({ ...form, revalidationDueAt: event.target.value })}
          />
        </Field>
      </div>
      <Field
        label="Limitaciones declaradas"
        tooltip="Para qué población o con qué supuestos NO sirve el modelo."
      >
        <textarea
          rows={3}
          value={form.limitationsNotes}
          placeholder="Población para la que NO sirve, supuestos, datos que el modelo no vio."
          onChange={(event) => setForm({ ...form, limitationsNotes: event.target.value })}
        />
      </Field>
      <p className="quality-note">
        Las limitaciones son la parte del expediente que más se usa y la que menos se escribe. «No
        validado para solicitantes sin seis meses de historial bancario» es lo que impide que
        alguien aplique el modelo a una población que nunca vio.
      </p>
      <div className="quality-inline-actions">
        <button
          type="button"
          className="button primary"
          disabled={!complete || record.isPending}
          onClick={submit}
        >
          {record.isPending ? 'Registrando…' : 'Registrar expediente'}
        </button>
        {form.revalidationDueAt <= form.validatedAt && (
          <span className="quality-muted">
            La revalidación tiene que ser posterior a la validación.
          </span>
        )}
      </div>
    </Panel>
  );
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Un año es el plazo corriente de revalidación de un modelo de crédito en uso. */
function inOneYear(): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return date.toISOString().slice(0, 10);
}
