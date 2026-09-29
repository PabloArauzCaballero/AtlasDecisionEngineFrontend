'use client';

import { useState } from 'react';
import { Panel } from '../../components/Panel';
import { StatusBadge } from '../../components/StatusBadge';
import { consentTone, useConsentLookup } from './risk-governance.api';
import { Field } from '../../components/Field';

const REASON_LABELS: Record<string, string> = {
  VALID: 'Vigente',
  MISSING: 'Sin constancia',
  REVOKED: 'Revocado',
  EXPIRED: 'Caducado',
  NOT_YET_GRANTED: 'Aún no vigente',
};

/** Dónde se registra y se revoca de verdad. Una sola frase, la misma en pantalla y en pruebas. */
export const CONSENT_SOURCE_NOTICE =
  'Los consentimientos se registran y revocan en Atlas Core (Portal admin ▸ Proveedores ' +
  'externos ▸ Datos del cliente); aquí sólo se consultan.';

/**
 * La licitud de tratar los datos de UNA persona, hoy — en SÓLO LECTURA.
 *
 * Es distinta de la base legal por versión de artefacto: aquélla dice con qué amparo se DISEÑÓ la
 * decisión, ésta si hoy se puede leer el extracto de esta persona.
 *
 * Antes se podía registrar y revocar a mano desde aquí. Era un segundo lugar donde cambiaba la
 * licitud, que Atlas Core —que es quien recoge el consentimiento del titular y lo replica al motor—
 * no conocía y que su réplica siguiente podía contradecir. El motor ahora rechaza esas escrituras
 * de una sesión de persona (`403 CONSENT_WRITE_MACHINE_ONLY`) y esta pantalla ya no las ofrece.
 *
 * Los cuatro motivos de invalidez se enseñan por separado: quien atiende necesita saber si caducó,
 * si no hay constancia o si lo revocaron.
 */
export function ConsentPanel() {
  const [reference, setReference] = useState('');
  const lookup = useConsentLookup();

  const consult = () => {
    const value = reference.trim();
    if (value) lookup.mutate(value);
  };

  return (
    <div className="quality-stack">
      <Panel
        title="Permisos de un titular"
        meta="la referencia no viaja en la URL"
        tutorialId="risk-consent"
      >
        <p className="quality-muted" data-testid="consent-source-notice">
          {CONSENT_SOURCE_NOTICE}
        </p>
        <div className="quality-form-grid">
          <Field
            label="Referencia del titular"
            tooltip="Referencia de la persona titular del dato, no su nombre."
          >
            <input
              value={reference}
              autoComplete="off"
              onChange={(event) => setReference(event.target.value)}
            />
          </Field>
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

        {lookup.isError && (
          <p className="quality-muted" role="alert">
            No se pudo consultar los permisos de este titular. Vuelve a intentarlo.
          </p>
        )}

        {lookup.data && (
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Finalidad</th>
                <th scope="col">Base legal</th>
                <th scope="col">Estado</th>
                <th scope="col">Caduca</th>
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
                </tr>
              ))}
              {!lookup.data.items.length && (
                <tr>
                  <td colSpan={4}>
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
    </div>
  );
}

/** Estado de una solicitud de reidentificación, con el vocabulario del motor. */
export function ReidentificationStatusBadge({ status }: { status: string }) {
  return <StatusBadge value={status} />;
}
