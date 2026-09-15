'use client';

import { useState } from 'react';
import { Panel } from '../../components/Panel';
import { useNotifications } from '../../notifications/useNotifications';
import { useFacilityRegistration, type OutcomeRowResult } from './decision-quality.api';
import { Field } from '../../components/Field';

/**
 * Alta puntual de un crédito concedido.
 *
 * El grueso lo carga la conciliación con cartera contra el mismo endpoint; esta pantalla existe
 * para el caso suelto —un desembolso que el core no reportó, una corrección— y, sobre todo, para
 * que se pueda VER lo que hace la conciliación sin leer un log.
 *
 * El solicitante no se pide: se toma de la decisión que originó el crédito. Dejar que se
 * escribiera aquí abriría la puerta a atar un préstamo a la persona equivocada por una errata,
 * y el motor rechaza el alta si esa decisión no identificó a nadie — que es el caso que la
 * cobertura de sujeto existe para evitar.
 */
export function FacilityRegistrationPanel() {
  const [form, setForm] = useState({
    externalReference: '',
    originationExecutionId: '',
    principalAmount: '',
    currencyCode: 'BOB',
    termMonths: '12',
    annualRate: '0.28',
    disbursedAt: '',
  });
  const [rows, setRows] = useState<OutcomeRowResult[] | null>(null);
  const register = useFacilityRegistration();
  const { notify } = useNotifications();

  const set = (key: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const complete =
    form.externalReference.trim() !== '' &&
    form.originationExecutionId.trim() !== '' &&
    Number.parseFloat(form.principalAmount) > 0;

  const submit = async () => {
    const result = await register.mutateAsync([
      {
        externalReference: form.externalReference.trim(),
        originationExecutionId: form.originationExecutionId.trim(),
        principalAmount: Number.parseFloat(form.principalAmount),
        currencyCode: form.currencyCode.trim().toUpperCase(),
        termMonths: Number.parseInt(form.termMonths, 10),
        annualRate: Number.parseFloat(form.annualRate),
        disbursedAt: form.disbursedAt ? `${form.disbursedAt}T00:00:00.000Z` : undefined,
      },
    ]);
    setRows(result.rows);
    if (result.registered) {
      notify({
        tone: 'success',
        title: 'Crédito registrado',
        description:
          'Sus ventanas de observación quedan programadas desde la fecha de la decisión.',
      });
    }
  };

  return (
    <Panel title="Alta de crédito concedido" meta="el solicitante se toma de la decisión de origen">
      <div className="quality-form-grid">
        <Field
          label="Referencia en cartera"
          tooltip="Referencia del crédito en el sistema de cartera. Ej.: LOAN-2026-000841."
        >
          <input
            value={form.externalReference}
            onChange={set('externalReference')}
            placeholder="LOAN-2026-000841"
          />
        </Field>
        <Field
          label="Decisión que lo originó"
          tooltip="Identificador de la ejecución del motor que aprobó el crédito."
        >
          <input
            value={form.originationExecutionId}
            onChange={set('originationExecutionId')}
            placeholder="88001"
          />
        </Field>
        <Field label="Importe" tooltip="Capital del crédito que se desembolsó.">
          <input
            value={form.principalAmount}
            onChange={set('principalAmount')}
            inputMode="decimal"
          />
        </Field>
        <Field label="Moneda" tooltip="Código ISO de 3 letras de la moneda. Ej.: BOB.">
          <input value={form.currencyCode} onChange={set('currencyCode')} maxLength={3} />
        </Field>
        <Field label="Plazo (meses)" tooltip="Duración del crédito en meses.">
          <input value={form.termMonths} onChange={set('termMonths')} inputMode="numeric" />
        </Field>
        <Field
          label="Tasa anual (tanto por uno)"
          tooltip="Tasa de interés anual como fracción. Ej.: 0.18 para un 18 %."
        >
          <input value={form.annualRate} onChange={set('annualRate')} inputMode="decimal" />
        </Field>
        <Field label="Desembolso" tooltip="Fecha en que se entregó el dinero al cliente.">
          <input type="date" value={form.disbursedAt} onChange={set('disbursedAt')} />
        </Field>
      </div>

      <div className="quality-inline-actions">
        <button
          type="button"
          className="button primary"
          disabled={!complete || register.isPending}
          onClick={submit}
        >
          {register.isPending ? 'Registrando…' : 'Registrar crédito'}
        </button>
      </div>

      {rows?.some((row) => !row.accepted) && (
        <ul className="quality-row-errors">
          {rows
            .filter((row) => !row.accepted)
            .map((row) => (
              <li key={row.externalReference}>
                <code>{row.code}</code> {row.message}
              </li>
            ))}
        </ul>
      )}
    </Panel>
  );
}
