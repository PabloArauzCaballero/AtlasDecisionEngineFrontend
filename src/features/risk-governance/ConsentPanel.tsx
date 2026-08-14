'use client';

import { useState } from 'react';
import { Panel } from '../../components/Panel';
import { StatusBadge } from '../../components/StatusBadge';
import { useNotifications } from '../../notifications/useNotifications';
import {
  consentTone,
  useConsentLookup,
  useRecordConsent,
  useRevokeConsent,
} from './risk-governance.api';

const BASES = [
  { code: 'CONSENT', label: 'Consentimiento del titular' },
  { code: 'CONTRACT', label: 'Ejecución de un contrato' },
  { code: 'LEGAL_OBLIGATION', label: 'Obligación legal' },
  { code: 'CREDIT_PROTECTION', label: 'Protección del crédito' },
  { code: 'LEGITIMATE_INTEREST', label: 'Interés legítimo' },
] as const;

const REASON_LABELS: Record<string, string> = {
  VALID: 'Vigente',
  MISSING: 'Sin constancia',
  REVOKED: 'Revocado',
  EXPIRED: 'Caducado',
  NOT_YET_GRANTED: 'Aún no vigente',
};

/**
 * La licitud de tratar los datos de UNA persona, hoy.
 *
 * Es distinta de la base legal por versión de artefacto, que ya existía: aquélla dice con qué
 * amparo se DISEÑÓ la decisión, ésta si hoy se puede leer el extracto de esta persona. Decidir con
 * un dato cuyo permiso venció es una infracción aunque el dato siga en la caché, y esa distinción
 * no la podía hacer nadie desde el portal.
 *
 * Los cuatro motivos de invalidez se enseñan por separado y no como un «no»: quien atiende
 * necesita saber si lo renueva (caducó), si tiene que pedirlo (no hay constancia) o si ya no puede
 * volver a pedirlo igual (lo revocaron).
 */
export function ConsentPanel() {
  const [reference, setReference] = useState('');
  const lookup = useConsentLookup();
  const record = useRecordConsent();
  const revoke = useRevokeConsent();
  const { notify } = useNotifications();
  const [form, setForm] = useState({
    purpose: 'BANK_STATEMENT_ANALYSIS',
    basis: 'CONSENT',
    expiresAt: '',
  });

  const consult = () => {
    const value = reference.trim();
    if (value) lookup.mutate(value);
  };

  const grant = async () => {
    const value = reference.trim();
    await record.mutateAsync({
      subjectReference: value,
      purpose: form.purpose.trim(),
      basis: form.basis,
      grantedAt: new Date().toISOString(),
      expiresAt: form.expiresAt ? `${form.expiresAt}T00:00:00.000Z` : undefined,
    });
    notify({
      tone: 'success',
      title: 'Permiso registrado',
      description: 'Queda con su vigencia declarada.',
    });
    lookup.mutate(value);
  };

  const cancel = async (purpose: string) => {
    const value = reference.trim();
    await revoke.mutateAsync({ subjectReference: value, purpose });
    notify({
      tone: 'success',
      title: 'Permiso revocado',
      description: `Ya no se puede tratar «${purpose}».`,
    });
    lookup.mutate(value);
  };

  return (
    <div className="quality-stack">
      <Panel
        title="Permisos de un titular"
        meta="la referencia no viaja en la URL"
        tutorialId="risk-consent"
      >
        <div className="quality-form-grid">
          <label className="field">
            <span>Referencia del titular</span>
            <input
              value={reference}
              autoComplete="off"
              onChange={(event) => setReference(event.target.value)}
            />
          </label>
        </div>
        <div className="quality-inline-actions">
          <button
            type="button"
            className="button primary"
            disabled={!reference.trim() || lookup.isPending}
            onClick={consult}
          >
            {lookup.isPending ? 'Consultando…' : 'Consultar permisos'}
          </button>
        </div>

        {lookup.data && (
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Finalidad</th>
                <th scope="col">Base legal</th>
                <th scope="col">Estado</th>
                <th scope="col">Caduca</th>
                <th scope="col" />
              </tr>
            </thead>
            <tbody>
              {lookup.data.items.map((consent) => (
                <tr key={consent.id}>
                  <td>{consent.purpose}</td>
                  <td>{consent.basis}</td>
                  <td>
                    <span className={`status-badge status-${consentTone(consent.reason)}`}>
                      {REASON_LABELS[consent.reason] ?? consent.reason}
                    </span>
                  </td>
                  <td>
                    {consent.expiresAt ? (
                      <>
                        {new Date(consent.expiresAt).toLocaleDateString()}
                        {consent.daysRemaining !== null && consent.daysRemaining >= 0 && (
                          <span className="quality-muted"> ({consent.daysRemaining} d)</span>
                        )}
                      </>
                    ) : (
                      <span className="quality-muted">sin caducidad declarada</span>
                    )}
                  </td>
                  <td>
                    {consent.valid && (
                      <button
                        type="button"
                        className="button"
                        onClick={() => cancel(consent.purpose)}
                      >
                        Revocar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!lookup.data.items.length && (
                <tr>
                  <td colSpan={5}>
                    <span className="quality-muted">
                      Este titular no tiene ningún permiso registrado. La ausencia de constancia no
                      es una autorización.
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </Panel>

      <Panel
        title="Registrar un permiso"
        meta="vacío en «caduca» = sin caducidad declarada, que es una decisión"
      >
        <div className="quality-form-grid">
          <label className="field">
            <span>Finalidad</span>
            <input
              value={form.purpose}
              onChange={(event) => setForm({ ...form, purpose: event.target.value })}
            />
          </label>
          <label className="field">
            <span>Base legal</span>
            <select
              value={form.basis}
              onChange={(event) => setForm({ ...form, basis: event.target.value })}
            >
              {BASES.map((basis) => (
                <option key={basis.code} value={basis.code}>
                  {basis.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Caduca</span>
            <input
              type="date"
              value={form.expiresAt}
              onChange={(event) => setForm({ ...form, expiresAt: event.target.value })}
            />
          </label>
        </div>
        <div className="quality-inline-actions">
          <button
            type="button"
            className="button primary"
            disabled={!reference.trim() || !form.purpose.trim() || record.isPending}
            onClick={grant}
          >
            {record.isPending ? 'Registrando…' : 'Registrar permiso'}
          </button>
          {!reference.trim() && (
            <span className="quality-muted">
              Escribe primero la referencia del titular, arriba.
            </span>
          )}
        </div>
      </Panel>
    </div>
  );
}

/** Estado de una solicitud de reidentificación, con el vocabulario del motor. */
export function ReidentificationStatusBadge({ status }: { status: string }) {
  return <StatusBadge value={status} />;
}
