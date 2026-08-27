'use client';

import { StatusBadge } from '../../components/StatusBadge';
import { asRecord, asStrings } from '../../utils/records';
import {
  DECISION_HELP,
  DECISION_LABEL,
  FIELD_LABEL,
  REASON_LABEL,
  decisionTone,
  type IdentityDecision,
  type IdentityOutcome,
} from './identity-types';
import { IdentityEvidence } from './IdentityEvidence';
import { notasDesdeCodigos, WorkerNotes } from './WorkerNotes';

/**
 * Veredicto de una verificación de identidad, con la evidencia que lo sostiene.
 *
 * El orden no es decorativo: primero QUÉ se decidió y por qué, después los
 * datos leídos, y sólo al final las señales técnicas. Enseñar el parecido antes
 * que el veredicto invita a discutir la cifra en vez de la decisión.
 *
 * Se lee de forma defensiva (`asRecord`) porque el resultado es un JSON que
 * escribió el motor, quizá con una versión anterior del worker: un acceso
 * directo a un campo que ya no existe rompería la vista entera en vez de dejar
 * un hueco.
 */
export function IdentityResultView({ result }: { result: unknown }) {
  const data = asRecord(result) as unknown as Partial<IdentityOutcome>;
  const decision = (data.decision ?? 'INCONCLUSIVE') as IdentityDecision;
  const reasons = asStrings(data.reasonCodes);
  const fields = data.fields ?? {};
  const shown = Object.keys(FIELD_LABEL).filter((key) => fields[key]?.value);

  return (
    <div className="worker-result identity-result">
      <div className="worker-result-summary">
        <StatusBadge
          value={decisionTone(decision)}
          labels={{ [decisionTone(decision)]: DECISION_LABEL[decision] ?? decision }}
        />
        <p className="worker-result-explain">{DECISION_HELP[decision]}</p>
      </div>

      {reasons.length > 0 ? (
        <section>
          <h3 className="worker-section-title">Por qué</h3>
          {/*
           * El motivo va en español Y con su código al lado. La frase es de esta
           * pantalla; el código es el contrato —viaja a auditoría y a cualquier
           * otro cliente—, así que esconderlo obligaría a mirar el JSON crudo
           * para poder citarlo en un ticket.
           */}
          <ul className="identity-reasons">
            {reasons.map((code) => (
              <li key={code}>
                <span>{REASON_LABEL[code] ?? code}</span>
                <code>{code}</code>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {shown.length > 0 ? (
        <section>
          <h3 className="worker-section-title">Datos leídos del documento</h3>
          <dl className="identity-fields">
            {shown.map((key) => {
              const field = fields[key]!;
              return (
                <div key={key}>
                  <dt>{FIELD_LABEL[key]}</dt>
                  <dd>
                    {field.value}
                    {/*
                     * La procedencia distingue TRES cosas, no dos.
                     *
                     * `MRZ` es la zona de lectura mecánica del reverso: trae
                     * dígitos de control, así que es MÁS fiable que el texto
                     * impreso, no menos. Marcarla «deducido» —como hacía la
                     * primera versión, que sólo distinguía «OCR» de «lo demás»—
                     * invitaba a desconfiar justo del dato que se puede
                     * demostrar.
                     *
                     * `DERIVED` sí es una suposición: «Nombres» y «Apellidos»
                     * salen de partir un nombre completo por convención
                     * boliviana, no de un rótulo del documento.
                     */}
                    {field.source === 'MRZ' ? (
                      <span className="identity-field-source is-verified">verificado</span>
                    ) : field.source === 'DERIVED' ? (
                      <span className="identity-field-source">deducido</span>
                    ) : null}
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>
      ) : null}

      <IdentityEvidence outcome={data} />

      {/*
       * Las notas de calidad, que hasta ahora no salían de la traza descargable.
       *
       * Son las que explican una lectura pobre —poca luz, poca resolución, la
       * foto movida— y son ACCIONABLES: cada una se arregla repitiendo la foto,
       * que es justo lo que hay que poder decirle a quien la subió. Se pintan
       * incluso cuando el veredicto fue VERIFICADO, porque una verificación que
       * salió adelante con una imagen mala es un dato para quien audite después.
       *
       * El origen distingue la cédula de la selfie: la misma frase manda a hacer
       * dos cosas distintas según de cuál de las dos hable.
       */}
      <WorkerNotes
        notas={[
          ...notasDesdeCodigos(
            asStrings(data.quality?.document?.warnings),
            REASON_LABEL,
            'documento',
          ),
          ...notasDesdeCodigos(asStrings(data.quality?.selfie?.warnings), REASON_LABEL, 'selfie'),
        ]}
        ayuda="Cada una de estas notas se arregla repitiendo la captura. No impidieron llegar a un veredicto, pero explican con cuánto margen se llegó."
      />
    </div>
  );
}
