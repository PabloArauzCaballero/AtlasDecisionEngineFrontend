import { CheckCircle2, CircleAlert, TriangleAlert } from 'lucide-react';
import { asRecord, asRows, display } from '../../utils/records';
import type { UnknownRecord } from '../../utils/records';

interface ValidationReportPanelProps {
  /** Informe tal como lo devuelve `POST /v1/artifact-versions/:id/validate`. */
  report: unknown;
}

/**
 * Lo que la validación encontró de verdad.
 *
 * Sustituye a una lista de comprobaciones con la palomita ya puesta —«JSON
 * schema válido», «Tipos y expresiones compatibles»— que se pintaba igual
 * hubiera pasado lo que hubiera pasado, incluso sin haber validado nada. Una
 * pantalla que afirma que algo está bien sin haberlo mirado es peor que una
 * pantalla vacía: enseña a confiar en un adorno.
 */
export function ValidationReportPanel({ report }: ValidationReportPanelProps) {
  const data = asRecord(report);
  const errors = asRows(data.errors);
  const warnings = asRows(data.warnings);
  const metrics = asRecord(data.metrics);
  const valid = data.valid === true;

  return (
    <div className="validation-report">
      <p className={`validation-verdict tone-${valid ? 'success' : 'danger'}`}>
        {valid ? <CheckCircle2 size={17} /> : <CircleAlert size={17} />}
        <span>
          <strong>{valid ? 'El grafo es válido' : 'El grafo no es válido todavía'}</strong>
          <small>
            {valid
              ? 'No hay errores que impidan compilar.'
              : `${errors.length} error(es) que hay que corregir antes de compilar.`}
          </small>
        </span>
      </p>

      {/* Las cifras del grafo: lo que el motor recorrió para decidirlo. Sin
          ellas, un «válido» no dice sobre cuánto se pronunció. */}
      <dl className="validation-metrics">
        {[
          ['Nodos', 'nodeCount'],
          ['Conexiones', 'edgeCount'],
          ['Nodos alcanzables', 'reachableNodeCount'],
          ['Nodos terminales', 'terminalNodeCount'],
          ['Recorridos hasta el final', 'terminalPathCount'],
        ].map(([label, key]) => (
          <div key={key}>
            <dt>{label}</dt>
            <dd>{display(metrics, key)}</dd>
          </div>
        ))}
      </dl>

      <IssueList
        title="Errores"
        issues={errors}
        emptyText="Ninguno."
        icon={CircleAlert}
        tone="danger"
      />
      <IssueList
        title="Avisos"
        issues={warnings}
        emptyText="Ninguno."
        icon={TriangleAlert}
        tone="warning"
      />
    </div>
  );
}

function IssueList({
  title,
  issues,
  emptyText,
  icon: Icon,
  tone,
}: {
  title: string;
  issues: UnknownRecord[];
  emptyText: string;
  icon: typeof CircleAlert;
  tone: 'danger' | 'warning';
}) {
  return (
    <section className="validation-issues">
      <h3>
        {title} <span className="validation-issues-count">{issues.length}</span>
      </h3>
      {issues.length ? (
        <ul>
          {issues.map((issue, index) => (
            <li key={`${display(issue, 'code')}-${index}`} className={`tone-${tone}`}>
              <Icon size={15} aria-hidden="true" />
              <span>
                <code>{display(issue, 'code')}</code>
                {display(issue, 'message')}
                {/* Dónde está: un error sin sitio obliga a buscarlo a mano por
                    todo el grafo. */}
                {issue.entityKey ? (
                  <small>
                    en {display(issue, 'entityType')} {display(issue, 'entityKey')}
                  </small>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="validation-issues-empty">{emptyText}</p>
      )}
    </section>
  );
}
