'use client';

import { useState } from 'react';
import { Panel } from '../../components/Panel';
import { useNotifications } from '../../notifications/useNotifications';
import { useFacilityRegistration, type OutcomeRowResult } from './decision-quality.api';

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
        <label className="field">
          <span>Referencia en cartera</span>
          <input
            value={form.externalReference}
            onChange={set('externalReference')}
            placeholder="LOAN-2026-000841"
          />
        </label>
        <label className="field">
          <span>Decisión que lo originó</span>
          <input
            value={form.originationExecutionId}
            onChange={set('originationExecutionId')}
            placeholder="88001"
          />
        </label>
        <label className="field">
          <span>Importe</span>
          <input
            value={form.principalAmount}
            onChange={set('principalAmount')}
            inputMode="decimal"
          />
        </label>
        <label className="field">
          <span>Moneda</span>
          <input value={form.currencyCode} onChange={set('currencyCode')} maxLength={3} />
        </label>
        <label className="field">
          <span>Plazo (meses)</span>
          <input value={form.termMonths} onChange={set('termMonths')} inputMode="numeric" />
        </label>
        <label className="field">
          <span>Tasa anual (tanto por uno)</span>
          <input value={form.annualRate} onChange={set('annualRate')} inputMode="decimal" />
        </label>
        <label className="field">
          <span>Desembolso</span>
          <input type="date" value={form.disbursedAt} onChange={set('disbursedAt')} />
        </label>
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
