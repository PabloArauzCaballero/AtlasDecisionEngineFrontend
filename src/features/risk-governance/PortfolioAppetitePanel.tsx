'use client';

import { useState } from 'react';
import { EmptyState } from '../../components/EmptyState';
import { Panel } from '../../components/Panel';
import { useNotifications } from '../../notifications/useNotifications';
import {
  useExposureLimits,
  useRecordPortfolioState,
  useUpsertLimit,
  type ExposureLimit,
} from './risk-governance.api';

/**
 * Apetito de cartera: cuánto queda antes de topar.
 *
 * Es la pantalla que explica por qué una solicitud buena se rechazó un 28 de mes. Sin ella ese
 * rechazo parece un defecto del modelo, y la reacción natural —aflojar el corte— es exactamente la
 * equivocada: no sobraba riesgo, faltaba presupuesto.
 *
 * El límite en modo «sólo mide» se enseña distinto del que bloquea, porque son cosas distintas:
 * uno describe y el otro decide. Verlos iguales haría creer que la cartera está protegida cuando
 * lo único que hay es un número en una tabla.
 */
export function PortfolioAppetitePanel() {
  const limits = useExposureLimits();
  const items = limits.data?.items ?? [];

  return (
    <div className="quality-stack">
      <Panel
        title="Límites de cartera"
        meta={limits.isLoading ? 'Cargando…' : `${items.length} vigentes`}
        tutorialId="risk-appetite"
      >
        {!limits.isLoading && !items.length ? (
          <EmptyState
            illustration="empty"
            title="Sin límites declarados"
            description="El motor no está comprobando ninguna exposición máxima al decidir."
            example="Un límite vive aquí y no dentro de una regla del grafo por lo que pasa al clonar un artefacto: la regla se copia, se edita, y el límite desaparece sin que nadie lo decida."
          />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Límite</th>
                <th scope="col">Segmento</th>
                <th scope="col">Consumido</th>
                <th scope="col">Máximo</th>
                <th scope="col">Uso</th>
                <th scope="col">Modo</th>
              </tr>
            </thead>
            <tbody>
              {items.map((limit) => (
                <LimitRow key={limit.id} limit={limit} />
              ))}
            </tbody>
          </table>
        )}
      </Panel>
      <LimitForm />
      <PortfolioStateForm />
    </div>
  );
}

function LimitRow({ limit }: { limit: ExposureLimit }) {
  const percent = `${(limit.utilization * 100).toFixed(1)} %`;
  return (
    <tr>
      <td>{limit.limitCode}</td>
      <td>{limit.segment || <span className="quality-muted">toda la cartera</span>}</td>
      <td>{limit.currentValue.toLocaleString()}</td>
      <td>
        {limit.maxValue.toLocaleString()} {limit.currencyCode}
      </td>
      <td className={limit.utilization >= 0.9 ? 'quality-overdue' : undefined}>{percent}</td>
      <td>
        {limit.enforced ? (
          <span className="status-badge status-danger">Bloquea</span>
        ) : (
          <span className="status-badge status-warning">Sólo mide</span>
        )}
      </td>
    </tr>
  );
}

function LimitForm() {
  const [form, setForm] = useState({
    limitCode: 'SUBJECT_TOTAL',
    segment: '',
    maxValue: '',
    currencyCode: 'BOB',
    enforced: false,
  });
  const upsert = useUpsertLimit();
  const { notify } = useNotifications();

  const submit = async () => {
    await upsert.mutateAsync({
      limitCode: form.limitCode.trim(),
      segment: form.segment.trim() || undefined,
      maxValue: Number.parseFloat(form.maxValue),
      currencyCode: form.currencyCode.trim().toUpperCase(),
      enforced: form.enforced,
    });
    notify({
      tone: 'success',
      title: 'Límite guardado',
      description: form.enforced
        ? 'A partir de ahora el motor rechaza la decisión que lo superaría.'
        : 'Queda midiendo sin rechazar: así se estrena un límite sin parar la originación.',
    });
  };

  return (
    <Panel
      title="Declarar un límite"
      meta="empieza en «sólo mide» y endurécelo cuando veas el consumo"
    >
      <div className="quality-form-grid">
        <label className="field">
          <span>Código</span>
          <input
            value={form.limitCode}
            onChange={(event) => setForm({ ...form, limitCode: event.target.value })}
          />
        </label>
        <label className="field">
          <span>Segmento (vacío = toda la cartera)</span>
          <input
            value={form.segment}
            onChange={(event) => setForm({ ...form, segment: event.target.value })}
          />
        </label>
        <label className="field">
          <span>Máximo</span>
          <input
            value={form.maxValue}
            inputMode="decimal"
            onChange={(event) => setForm({ ...form, maxValue: event.target.value })}
          />
        </label>
        <label className="field">
          <span>Moneda</span>
          <input
            value={form.currencyCode}
            maxLength={3}
            onChange={(event) => setForm({ ...form, currencyCode: event.target.value })}
          />
        </label>
      </div>
      <label className="field-inline">
        <input
          type="checkbox"
          checked={form.enforced}
          onChange={(event) => setForm({ ...form, enforced: event.target.checked })}
        />
        <span>Rechazar la decisión que lo supere (si no, sólo mide y avisa)</span>
      </label>
      <div className="quality-inline-actions">
        <button
          type="button"
          className="button primary"
          disabled={
            !form.limitCode.trim() || !(Number.parseFloat(form.maxValue) > 0) || upsert.isPending
          }
          onClick={submit}
        >
          {upsert.isPending ? 'Guardando…' : 'Guardar límite'}
        </button>
      </div>
    </Panel>
  );
}

function PortfolioStateForm() {
  const [form, setForm] = useState({ metricCode: 'TOTAL_EXPOSURE', segment: '', value: '' });
  const record = useRecordPortfolioState();
  const { notify } = useNotifications();

  const submit = async () => {
    await record.mutateAsync({
      asOf: new Date().toISOString(),
      metricCode: form.metricCode.trim(),
      segment: form.segment.trim() || undefined,
      value: Number.parseFloat(form.value),
    });
    notify({
      tone: 'success',
      title: 'Estado registrado',
      description: 'El consumo de los límites se recalcula con él.',
    });
  };

  return (
    <Panel
      title="Reportar estado de cartera"
      meta="lo normal es que lo haga la conciliación; esto es para verlo y corregirlo"
    >
      <div className="quality-form-grid">
        <label className="field">
          <span>Métrica</span>
          <input
            value={form.metricCode}
            onChange={(event) => setForm({ ...form, metricCode: event.target.value })}
          />
        </label>
        <label className="field">
          <span>Segmento</span>
          <input
            value={form.segment}
            onChange={(event) => setForm({ ...form, segment: event.target.value })}
          />
        </label>
        <label className="field">
          <span>Valor</span>
          <input
            value={form.value}
            inputMode="decimal"
            onChange={(event) => setForm({ ...form, value: event.target.value })}
          />
        </label>
      </div>
      <div className="quality-inline-actions">
        <button
          type="button"
          className="button primary"
          disabled={!Number.isFinite(Number.parseFloat(form.value)) || record.isPending}
          onClick={submit}
        >
          {record.isPending ? 'Registrando…' : 'Registrar estado'}
        </button>
      </div>
    </Panel>
  );
}
