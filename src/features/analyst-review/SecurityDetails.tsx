import { GitBranch, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { Panel } from '../../components/Panel';
import { SeverityBadge } from '../../components/SeverityBadge';
import { asRecord, asRows, display, type UnknownRecord } from '../../utils/records';

/**
 * Lo que la revisión de seguridad añade a la del analista: hallazgos, scripts, dependencias,
 * incidentes y datos que toca.
 *
 * Va DEBAJO de la firma y cada bloque sólo aparece si tiene algo. Antes eran cinco paneles
 * arriba del todo, casi siempre con «Sin …», que empujaban fuera de la pantalla lo único que
 * hacía falta leer para aprobar: las reglas y las corridas.
 */
export function SecurityDetails({ review }: { review: UnknownRecord }) {
  const findings = asRows(review.findings);
  const code = asRows(review.code);
  const variables = asRows(review.variables);
  const nestedTrees = asRecord(review.nestedTrees);
  const dependsOn = asRows(nestedTrees.dependsOn);
  const dependedOnBy = asRows(nestedTrees.dependedOnBy);
  const incidents = asRows(review.incidents);
  const sensibles = variables.filter((variable) => variable.isSensitive);

  return (
    <Panel
      title="Seguridad y datos"
      meta={`${findings.length} hallazgos · ${sensibles.length} datos sensibles`}
    >
      <div className="analyst-intro">
        <p>
          <SeverityBadge value={review.severity} />{' '}
          {findings.length
            ? 'El análisis estático encontró lo siguiente:'
            : 'El análisis estático no encontró riesgos en esta versión.'}
        </p>
        {findings.length ? (
          <ul className="dependency-list">
            {findings.map((finding, index) => (
              <li key={index}>
                <ShieldAlert size={14} aria-hidden="true" />
                <SeverityBadge value={finding.severity} />
                {display(finding, 'message')}
              </li>
            ))}
          </ul>
        ) : null}

        {code.map((script, index) => (
          <pre key={index} className="security-code-excerpt">
            {display(script, 'nodeKey')} · {display(script, 'language')}
            {'\n'}
            {display(script, 'sourceExcerpt')}
          </pre>
        ))}

        {dependsOn.length || dependedOnBy.length ? (
          <ul className="dependency-list">
            {dependsOn.map((reference, index) => (
              <li key={`dep-${index}`}>
                <GitBranch size={14} aria-hidden="true" />
                Depende del artefacto {display(reference, 'childArtifactId')} (
                {display(reference, 'nodeKey')})
              </li>
            ))}
            {dependedOnBy.map((reference, index) => (
              <li key={`ref-${index}`}>
                <GitBranch size={14} aria-hidden="true" />
                La usa la versión {display(reference, 'parentArtifactVersionId')}
              </li>
            ))}
          </ul>
        ) : null}

        {incidents.length ? (
          <ul className="dependency-list">
            {incidents.map((incident, index) => (
              <li key={index}>
                {display(incident, 'eventType')} · {display(incident, 'occurredAt')} ·{' '}
                <Link href={`/artifacts/${display(incident, 'artifactId')}`}>Ver artefacto</Link>
              </li>
            ))}
          </ul>
        ) : null}

        <details>
          <summary>Datos que lee y escribe ({variables.length})</summary>
          <ul className="dependency-list">
            {variables.map((variable, index) => (
              <li key={index}>
                <span className="dependency-node-key">{display(variable, 'usageType')}</span>
                {display(variable, 'code')} ({display(variable, 'dataClassification')}
                {variable.isSensitive ? ', sensible' : ''})
              </li>
            ))}
          </ul>
        </details>
      </div>
    </Panel>
  );
}
