import { CheckCircle2, CircleDashed, TriangleAlert } from 'lucide-react';
import { Panel } from '../../components/Panel';
import { asRecord, display } from '../../utils/records';

interface PlatformHealthPanelsProps {
  /** Respuesta de `/health/live` y `/health/ready`, si llegaron. */
  live: unknown;
  ready: unknown;
  operational: boolean;
  loading: boolean;
  /** Ambientes activos declarados por el backend. */
  environments: string[];
}

/**
 * Salud de la plataforma.
 *
 * Las comprobaciones se leen de la respuesta real de `/health/ready`: cuando el
 * backend detalla sus dependencias, se listan una a una con su estado; cuando
 * sólo responde "ok", se dice exactamente eso en lugar de fingir una lista de
 * verificaciones que nadie ha hecho.
 */
export function PlatformHealthPanels({
  live,
  ready,
  operational,
  loading,
  environments,
}: PlatformHealthPanelsProps) {
  const readyRecord = asRecord(ready);
  const details = asRecord(readyRecord.checks ?? readyRecord.details ?? readyRecord.components);
  const entries = Object.entries(details);

  return (
    <div className="health-layout">
      <Panel title="Comprobaciones de disponibilidad" meta={loading ? 'Consultando…' : 'En vivo'}>
        {entries.length ? (
          <ul className="check-list">
            {entries.map(([name, value]) => {
              const status = statusText(value);
              const healthy = isHealthy(status);
              return (
                <li key={name}>
                  {healthy ? <CheckCircle2 /> : <TriangleAlert />}
                  <span>
                    {name}
                    <small>{healthy ? 'Responde correctamente' : 'Revisar esta dependencia'}</small>
                  </span>
                  <code>{status}</code>
                </li>
              );
            })}
          </ul>
        ) : (
          <ul className="check-list">
            <li>
              {operational ? <CheckCircle2 /> : <CircleDashed />}
              <span>
                Servicio de decisiones
                <small>
                  {operational
                    ? 'El backend respondió a las sondas de vida y de disponibilidad.'
                    : 'Sin respuesta del backend: no es posible confirmar el estado.'}
                </small>
              </span>
              <code>{operational ? 'OK' : '—'}</code>
            </li>
          </ul>
        )}
      </Panel>

      <Panel title="Contexto de despliegue" meta="Datos del backend">
        <div className={`alert-card ${operational ? '' : 'alert-card-danger'}`}>
          {operational ? <CheckCircle2 /> : <TriangleAlert />}
          <div>
            <strong>{operational ? 'Sin alertas críticas' : 'Backend no disponible'}</strong>
            <p>
              {operational
                ? 'La plataforma acepta tráfico de gestión y de ejecución.'
                : 'No se pudo contactar con el motor de decisiones. Las métricas mostradas pueden estar incompletas.'}
            </p>
          </div>
        </div>
        <div className="system-summary">
          <span>Versión del build</span>
          <code>{display(asRecord(live), 'version', 'build')}</code>
          <span>Ambientes activos</span>
          <strong>{environments.length ? environments.join(' · ') : '—'}</strong>
        </div>
      </Panel>
    </div>
  );
}

/**
 * Palabras con las que el motor declara que una dependencia NO está bien.
 *
 * Se listan los fallos, no los aciertos: el backend responde con valores
 * libres (`ok`, pero también `redis` para nombrar el proveedor de caché), y
 * exigir una lista blanca marcaría como caída una dependencia sana sólo por
 * describirse con otra palabra.
 */
const UNHEALTHY = /^(DOWN|FAIL|FAILED|ERROR|KO|FALSE|UNAVAILABLE|DEGRADED|OFF|TIMEOUT)$/;

export function isHealthy(status: string): boolean {
  return status !== '—' && !UNHEALTHY.test(status);
}

function statusText(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return display(asRecord(value), 'status', 'state', 'health');
  return String(value).toUpperCase();
}
