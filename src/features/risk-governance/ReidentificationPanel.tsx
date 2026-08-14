'use client';

import { useState } from 'react';
import { EmptyState } from '../../components/EmptyState';
import { Panel } from '../../components/Panel';
import { useAuth } from '../../auth/useAuth';
import { useNotifications } from '../../notifications/useNotifications';
import {
  useDecideReidentification,
  useReidentifications,
  useRequestReidentification,
} from './risk-governance.api';
import { ReidentificationStatusBadge } from './ConsentPanel';

/**
 * Ir del caso seudónimo a la persona, con dos firmas y por escrito.
 *
 * El HMAC protege bien y estorba para operar: atender un reclamo exige poder llegar al titular. La
 * salida no es aflojar el hash —eso lo aflojaría para todo— sino que el camino exista, cueste dos
 * personas distintas y quede registrado.
 *
 * El botón de aprobar se apaga sobre la propia solicitud. El motor lo rechaza igualmente; apagarlo
 * aquí evita que alguien descubra la regla estrellándose contra un 403, que es la peor forma de
 * enterarse de un control.
 */
export function ReidentificationPanel() {
  const list = useReidentifications();
  const request = useRequestReidentification();
  const decide = useDecideReidentification();
  const { user } = useAuth();
  const { notify } = useNotifications();
  const [form, setForm] = useState({ subjectReference: '', purpose: '' });
  const items = list.data?.items ?? [];

  const submit = async () => {
    await request.mutateAsync({
      subjectReference: form.subjectReference.trim(),
      purpose: form.purpose.trim(),
    });
    setForm({ subjectReference: '', purpose: '' });
    notify({
      tone: 'success',
      title: 'Reidentificación solicitada',
      description: 'Queda pendiente de que OTRA persona la apruebe.',
    });
  };

  const resolve = async (requestId: string, approve: boolean) => {
    await decide.mutateAsync({ requestId, approve });
    notify({
      tone: 'success',
      title: approve ? 'Reidentificación aprobada' : 'Reidentificación denegada',
      description: 'La decisión queda en el registro de auditoría con quién la tomó.',
    });
  };

  return (
    <div className="quality-stack">
      <Panel
        title="Solicitar una reidentificación"
        meta="quien la pide no puede aprobarla"
        tutorialId="risk-reidentification"
      >
        <div className="quality-form-grid">
          <label className="field">
            <span>Referencia del titular</span>
            <input
              value={form.subjectReference}
              autoComplete="off"
              onChange={(event) => setForm({ ...form, subjectReference: event.target.value })}
            />
          </label>
          <label className="field quality-field-wide">
            <span>Por qué hace falta</span>
            <input
              value={form.purpose}
              placeholder="Reclamo 4471 en defensa del consumidor: hay que contactar al titular."
              onChange={(event) => setForm({ ...form, purpose: event.target.value })}
            />
          </label>
        </div>
        <div className="quality-inline-actions">
          <button
            type="button"
            className="button primary"
            disabled={!form.subjectReference.trim() || !form.purpose.trim() || request.isPending}
            onClick={submit}
          >
            {request.isPending ? 'Solicitando…' : 'Solicitar'}
          </button>
        </div>
      </Panel>

      <Panel
        title="Solicitudes"
        meta={list.isLoading ? 'Cargando…' : `${items.length} registradas`}
      >
        {!list.isLoading && !items.length ? (
          <EmptyState
            illustration="empty"
            title="Nadie ha pedido reidentificar a nadie"
            description="Este registro existe para que pedirlo deje huella."
            example="Una consulta libre sería lo mismo que no cifrar: el valor del seudónimo está en que llegar a la persona cueste una decisión de otra persona."
          />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Motivo</th>
                <th scope="col">Pidió</th>
                <th scope="col">Estado</th>
                <th scope="col">Resolvió</th>
                <th scope="col" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const isOwn = user?.email === item.requestedBy || user?.id === item.requestedBy;
                return (
                  <tr key={item.id}>
                    <td>{item.purpose}</td>
                    <td>
                      {item.requestedBy}
                      <br />
                      <span className="quality-muted">
                        {new Date(item.requestedAt).toLocaleString()}
                      </span>
                    </td>
                    <td>
                      <ReidentificationStatusBadge status={item.status} />
                    </td>
                    <td>{item.decidedBy ?? <span className="quality-muted">—</span>}</td>
                    <td>
                      {item.status === 'REQUESTED' && (
                        <div className="quality-inline-actions">
                          <button
                            type="button"
                            className="button primary"
                            disabled={isOwn || decide.isPending}
                            title={
                              isOwn
                                ? 'Quien pide una reidentificación no puede aprobarla.'
                                : undefined
                            }
                            onClick={() => resolve(item.id, true)}
                          >
                            Aprobar
                          </button>
                          <button
                            type="button"
                            className="button"
                            disabled={decide.isPending}
                            onClick={() => resolve(item.id, false)}
                          >
                            Denegar
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
