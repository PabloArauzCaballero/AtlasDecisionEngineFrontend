'use client';

import { asStrings } from '../../utils/records';
import { REASON_LABEL, type IdentityOutcome } from './identity-types';

/**
 * Las señales de las que salió el veredicto.
 *
 * Va debajo de la decisión y no arriba: primero se dice qué se decidió, luego
 * con qué. Y va SIEMPRE, también cuando el resultado es limpio, porque una
 * verificación aprobada sin evidencia visible no se puede auditar después.
 */
export function IdentityEvidence({ outcome }: { outcome: Partial<IdentityOutcome> }) {
  const match = outcome.faceMatch ?? null;
  const quality = outcome.quality;
  const riesgos = asStrings(outcome.riskFlags);
  const providers = outcome.providers;

  return (
    <section className="identity-evidence">
      <h3 className="worker-section-title">Evidencia</h3>

      <dl className="worker-run-facts">
        <div>
          <dt>Parecido</dt>
          <dd>
            {/*
             * `null` NO se pinta como 0 %. «No se pudo comparar» y «no se
             * parecen en nada» tienen consecuencias opuestas para quien se
             * verifica, y un 0 % afirmaría la segunda.
             */}
            {match && match.comparable && match.similarityScore !== null
              ? `${Math.round(match.similarityScore * 100)} %`
              : 'No se pudo comparar'}
            {match && !match.comparable && match.notComparableReason ? (
              <span className="identity-field-source">
                {REASON_LABEL[match.notComparableReason] ?? match.notComparableReason}
              </span>
            ) : null}
          </dd>
        </div>
        <div>
          <dt>Prueba de vida</dt>
          <dd>{LIVENESS_LABEL[outcome.liveness?.outcome ?? ''] ?? '—'}</dd>
        </div>
        <div>
          <dt>Calidad del documento</dt>
          <dd>{quality ? `${Math.round(quality.document.score * 100)} %` : '—'}</dd>
        </div>
        <div>
          <dt>Calidad de la selfie</dt>
          <dd>{quality ? `${Math.round(quality.selfie.score * 100)} %` : '—'}</dd>
        </div>
        <div>
          <dt>Encuadre</dt>
          <dd>
            {/*
             * Qué tuvo delante el lector. Ante una lectura pobre es la primera
             * pregunta, y sin esto habría que reproducir la ejecución para
             * contestarla.
             */}
            {outcome.framing?.recortado
              ? `Recortado del fondo (${Math.round(outcome.framing.areaConservada * 100)} % de la foto)`
              : 'La foto entera'}
          </dd>
        </div>
        <div>
          <dt>Perfil de umbrales</dt>
          <dd>
            <code>{outcome.thresholdProfileVersion ?? '—'}</code>
          </dd>
        </div>
        <div>
          <dt>Tipo de documento</dt>
          <dd>
            <code>{outcome.documentType ?? '—'}</code>
          </dd>
        </div>
      </dl>

      {riesgos.length > 0 ? (
        <>
          <h4 className="worker-section-title">Marcas de riesgo</h4>
          <ul className="identity-reasons">
            {riesgos.map((code) => (
              <li key={code}>
                <span>{REASON_LABEL[code] ?? code}</span>
                <code>{code}</code>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {providers ? (
        <p className="identity-providers">
          Decidido con <code>{providers.ocr}</code> (lectura), <code>{providers.face}</code>{' '}
          (rostro) y <code>{providers.liveness}</code> (prueba de vida).
        </p>
      ) : null}
    </section>
  );
}

const LIVENESS_LABEL: Record<string, string> = {
  PASSED: 'Superada',
  FAILED: 'No superada',
  INCONCLUSIVE: 'No concluyente',
  NOT_RUN: 'No se ejecutó',
};
