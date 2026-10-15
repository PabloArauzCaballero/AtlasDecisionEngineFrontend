'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Field } from '../../components/Field';
import { OptionSelect } from '../../components/OptionSelect';
import { useNotifications } from '../../notifications/useNotifications';
import {
  fetchInstitutionSummary,
  fetchInstitutions,
  LICENSE_STATUS_LABELS,
} from './institutions.api';
import { reprocessStatementReview } from './statement-review.api';
import type { StatementReviewDetail } from './statement-review';

/**
 * Asignar a mano la entidad que emitió el extracto y reprocesarlo con ella.
 *
 * Pablo (2026-10-15): «poder manualmente ponerle la entidad financiera». Quien revisa ve el PDF y sabe
 * de qué banco es; el motor deja de adivinar y procesa con esa entidad. Queda en el caso (quién y
 * cuándo) y en la auditoría. Las opciones son el padrón; si al padrón le faltan entidades de la nómina
 * de ASFI, salen igual por su sigla: el motor las acepta, y quedarse sin opción porque la tabla del
 * entorno está incompleta es el defecto que esto existe para sortear.
 */
export function StatementInstitutionAssign({
  detalle,
  onDone,
}: {
  detalle: StatementReviewDetail;
  onDone: () => Promise<void> | void;
}) {
  const { promise } = useNotifications();
  const [codigo, setCodigo] = useState(detalle.assignedInstitution?.code ?? '');
  const padron = useQuery({
    queryKey: ['institutions', 'activas'],
    queryFn: ({ signal }) => fetchInstitutions(false, signal),
  });
  const resumen = useQuery({
    queryKey: ['institutions', 'resumen'],
    queryFn: ({ signal }) => fetchInstitutionSummary(signal),
  });

  const opciones = useMemo(() => {
    const delPadron = (padron.data ?? []).map((item) => ({
      value: item.code,
      label: `${item.code} · ${item.name}`,
      description: LICENSE_STATUS_LABELS[item.licenseStatus] ?? item.licenseStatus,
    }));
    const faltantes = (resumen.data?.missingFromSeed ?? [])
      .filter((sigla) => !delPadron.some((item) => item.value === sigla))
      .map((sigla) => ({
        value: sigla,
        label: `${sigla} · nómina de ASFI`,
        description: 'Está en la nómina de ASFI pero todavía no en el padrón de este entorno.',
      }));
    return [...delPadron, ...faltantes].sort((a, b) => a.value.localeCompare(b.value));
  }, [padron.data, resumen.data]);

  const reprocesar = useMutation({
    mutationFn: () =>
      promise(reprocessStatementReview(detalle.requestId, codigo), {
        loading: 'Reprocesando con la entidad asignada…',
        success: `Enviado con la entidad ${codigo}: el motor lo vuelve a leer como extracto de esa entidad.`,
      }),
    onSuccess: onDone,
  });

  return (
    <section className="revision-caso-entidad" data-testid="statement-assign-institution">
      <h4>Entidad financiera</h4>
      {detalle.assignedInstitution ? (
        <p className="field-help">
          Asignada a mano: <strong>{detalle.assignedInstitution.code}</strong>
          {detalle.assignedInstitution.by ? ` por ${detalle.assignedInstitution.by}` : ''}.
        </p>
      ) : (
        <p className="field-help">
          El motor no reconoció de qué entidad es este extracto. Mira el PDF y asígnala: se vuelve a
          procesar como extracto de esa entidad.
        </p>
      )}
      <Field
        label="Entidad que emitió el extracto"
        tooltip="La entidad financiera que figura en el PDF (logotipo, razón social o dominio)."
      >
        <OptionSelect
          name="entidad"
          value={codigo}
          onChange={setCodigo}
          placeholder={padron.isPending ? 'Cargando el padrón…' : 'Elige la entidad'}
          options={opciones}
        />
      </Field>
      <div className="worker-run-actions">
        <button
          type="button"
          className="button button-primary"
          disabled={!codigo || reprocesar.isPending || !detalle.documentAvailable}
          onClick={() => reprocesar.mutate()}
        >
          {reprocesar.isPending ? 'Enviando…' : 'Reprocesar con esta entidad'}
        </button>
      </div>
    </section>
  );
}
