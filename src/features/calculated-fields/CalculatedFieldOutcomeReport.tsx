'use client';

import { AlertTriangle, Ban, Check, X } from 'lucide-react';
import type { OutcomeReport } from './calculated-field-preview';

interface Props {
  report: OutcomeReport;
}

/**
 * Qué salidas del contrato de retorno se alcanzan de verdad.
 *
 * Un campo calculado no tiene ramas que recorrer como un grafo: sus finales los fija el
 * contrato —valor válido, sin valor, valor por defecto, fallo con el código declarado—, y
 * la única forma honesta de saber cuáles ocurren es generar entradas, ejecutarlas y mirar.
 *
 * Lo que se viene a leer aquí son las DOS listas incómodas: los desenlaces declarados que
 * ningún caso alcanzó, y los que el contrato no puede producir nunca. Una tabla que sólo
 * enseñara los cubiertos se leería como «probado todo».
 */
export function CalculatedFieldOutcomeReport({ report }: Props) {
  return (
    <div className="calculated-outcomes">
      <p className="field-hint">
        {report.total} casos ejecutados ({report.countPerKind} por clase) · semilla{' '}
        <code>{report.seed}</code> — repítela para reproducir exactamente esta tanda.
      </p>

      <ul className="outcome-list">
        {report.declared.map((outcome) => (
          <li key={outcome.code} className={outcome.covered ? 'is-covered' : 'is-uncovered'}>
            <span className="outcome-mark" aria-hidden>
              {outcome.unreachable ? (
                <Ban size={14} />
              ) : outcome.covered ? (
                <Check size={14} />
              ) : (
                <X size={14} />
              )}
            </span>
            <div>
              <b>{outcome.label}</b> <code>{outcome.code}</code>
              <small>{outcome.reason}</small>
              {outcome.unreachable ? (
                <small className="outcome-unreachable">
                  <AlertTriangle size={12} aria-hidden /> El contrato lo declara pero el motor no
                  puede producirlo: {outcome.unreachable}
                </small>
              ) : !outcome.covered ? (
                <small>
                  Ningún caso de esta tanda lo alcanzó. Sube el número de casos o escribe un caso de
                  prueba que lo fuerce.
                </small>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {report.undeclared.length ? (
        <p className="field-hint">
          Además ocurrieron desenlaces que el contrato de retorno no declara —casi siempre entradas
          rechazadas, que es lo que los casos inválidos buscan—:{' '}
          {report.undeclared.map((code) => (
            <code key={code}>{code}</code>
          ))}
        </p>
      ) : null}

      <details className="outcome-cases">
        <summary>Ver los {report.cases.length} casos ejecutados</summary>
        <ul>
          {report.cases.map((sample) => (
            <li key={sample.index}>
              <code>{sample.outcome}</code>
              <small>
                {sample.kind}
                {sample.mutation ? ` · ${sample.mutation}` : ''} · {JSON.stringify(sample.input)}
              </small>
              <small>
                {sample.error ? sample.error : `→ ${JSON.stringify(sample.value ?? null)}`}
              </small>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
