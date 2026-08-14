'use client';

import { ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { StatusBadge } from '../components/StatusBadge';
import { formatDate } from '../config/locale';
import { DataSubjectResult } from '../features/data-subject/DataSubjectResult';
import {
  REQUEST_TYPES,
  useDataSubjectHistory,
  useSubmitDataSubjectRequest,
} from '../features/data-subject/data-subject.api';
import { asRecord, asRows, display } from '../utils/records';

/**
 * Derechos del titular de datos (LGPD art. 18 y 20; CCPA/CPRA).
 *
 * El motor sabía atender estas solicitudes desde hacía meses y no había ninguna pantalla que las
 * pidiera: atender el derecho de una persona exigía entrar por consola, que es exactamente donde no
 * mira quien atiende el canal de cumplimiento.
 *
 * Dos cosas que esta vista respeta y conviene no deshacer:
 *
 * 1. **La referencia del titular nunca viaja en la URL.** Ni en la ruta, ni en la cadena de
 *    consulta, ni siquiera para la consulta de historial —por eso el motor la expone como `POST`—.
 *    Un identificador en una URL acaba en el registro de acceso, en el proxy y en la traza.
 * 2. **Registrar la solicitud ES atenderla.** El motor guarda el expediente y resuelve contra el
 *    historial en la misma llamada, así que aquí no hay «guardar borrador»: lo que se pulsa deja
 *    constancia de que alguien consultó todas las decisiones sobre una persona.
 */
export function DataSubjectRequestsPage() {
  const [subjectReference, setSubjectReference] = useState('');
  const [requestType, setRequestType] = useState<string>('ACCESS');
  const [reference, setReference] = useState('');

  const submit = useSubmitDataSubjectRequest();
  const history = useDataSubjectHistory();

  const trimmed = subjectReference.trim();
  const selected = REQUEST_TYPES.find((type) => type.code === requestType);
  const historyItems = asRows(asRecord(history.data).items);

  return (
    <>
      <PageHeader
        eyebrow="Auditoría"
        title="Derechos del titular"
        description="Registra y resuelve una solicitud de acceso, portabilidad, eliminación o revisión humana contra el historial de decisiones."
        hint="La referencia del titular viaja siempre en el cuerpo de la petición, nunca en la dirección: un identificador en una URL queda escrito en el registro de acceso, en el proxy y en la traza."
      />

      <Panel title="Nueva solicitud">
        <form
          className="dsr-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!trimmed) return;
            submit.mutate({
              subjectReference: trimmed,
              requestType,
              reference: reference.trim() || undefined,
            });
          }}
        >
          <label data-tutorial-id="dsr-subject">
            <span>Referencia del titular</span>
            <input
              value={subjectReference}
              onChange={(event) => setSubjectReference(event.target.value)}
              placeholder="La misma con la que se ejecutaron las decisiones"
              autoComplete="off"
              required
            />
          </label>

          <label data-tutorial-id="dsr-type">
            <span>Derecho ejercido</span>
            <select value={requestType} onChange={(event) => setRequestType(event.target.value)}>
              {REQUEST_TYPES.map((type) => (
                <option key={type.code} value={type.code}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Expediente del canal (opcional)</span>
            <input
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="TICKET-9912"
              autoComplete="off"
            />
          </label>

          <p className="dsr-note">
            <ShieldCheck size={14} aria-hidden />
            <span>{selected?.hint}</span>
          </p>

          <div className="dsr-actions">
            <button
              type="submit"
              className="primary"
              data-tutorial-id="dsr-submit"
              disabled={!trimmed || submit.isPending}
            >
              {submit.isPending ? 'Resolviendo…' : 'Registrar y resolver'}
            </button>
            <button
              type="button"
              data-tutorial-id="dsr-history"
              disabled={!trimmed || history.isPending}
              onClick={() => history.mutate(trimmed)}
            >
              {history.isPending ? 'Consultando…' : 'Ver solicitudes anteriores'}
            </button>
          </div>
        </form>
      </Panel>

      {submit.data ? <DataSubjectResult result={asRecord(submit.data)} /> : null}

      {history.data ? (
        <Panel
          title="Solicitudes anteriores"
          meta={`${Number(asRecord(history.data).total ?? 0)} en total`}
        >
          {historyItems.length ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Derecho</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Atendida por</th>
                  <th scope="col">Expediente</th>
                  <th scope="col">Registrada</th>
                  <th scope="col">Resuelta</th>
                </tr>
              </thead>
              <tbody>
                {historyItems.map((item) => (
                  <tr key={display(item, 'id')}>
                    <td>{display(item, 'requestType')}</td>
                    <td>
                      <StatusBadge value={display(item, 'status')} />
                    </td>
                    <td>{display(item, 'receivedBy')}</td>
                    <td>{display(item, 'reference')}</td>
                    <td>{formatDate(display(item, 'createdAt'))}</td>
                    <td>{formatDate(display(item, 'resolvedAt'))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="dsr-note">
              Este titular no tiene solicitudes anteriores. Que no las tenga no significa que no
              haya decisiones sobre él: eso lo responde el derecho de acceso.
            </p>
          )}
        </Panel>
      ) : null}

      {!submit.data && !history.data ? (
        <EmptyState
          illustration="empty"
          title="Introduce la referencia del titular"
          description="Con ella se resuelve la solicitud contra todas las decisiones que el motor tomó sobre esa persona. Cada consulta queda registrada, porque consultar el historial de alguien es en sí mismo un acceso a sus datos."
          example="ACCESS · PORTABILITY · ERASURE · REVIEW"
        />
      ) : null}
    </>
  );
}
