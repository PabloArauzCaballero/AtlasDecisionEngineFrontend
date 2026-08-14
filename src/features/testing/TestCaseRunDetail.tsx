'use client';

import { ChevronDown, Flag, Route } from 'lucide-react';
import { useState } from 'react';
import { StatusBadge } from '../../components/StatusBadge';
import { asRecord, asRows, display, type UnknownRecord } from '../../utils/records';

interface Props {
  caseRun: UnknownRecord;
}

/**
 * Un caso de prueba, abierto: con qué entró, qué se esperaba, qué salió y por
 * dónde pasó.
 *
 * La corrida enseñaba una fila por caso con su estado y, sólo si fallaba, las
 * aserciones rotas. De un caso que PASA no se veía nada — ni sus entradas, ni el
 * resultado, ni el camino que recorrió— así que no se podía revisar por qué
 * aprobó, que es justo lo que pregunta un auditor. Y de uno que falla tampoco se
 * veía el recorrido, que es lo que dice DÓNDE se desvió.
 *
 * Todo esto ya venía en la respuesta (`actualResultJson`, con su `trace`); sólo
 * que no se pintaba.
 */
export function TestCaseRunDetail({ caseRun }: Props) {
  const [open, setOpen] = useState(false);

  const testCase = asRecord(caseRun.testCase);
  const actual = asRecord(caseRun.actualResultJson);
  const expected = asRecord(testCase.expectedResultJson);
  const inputs = asRecord(testCase.inputJson);
  const trace = asRecord(actual.trace);
  const nodes = Array.isArray(trace.nodes) ? (trace.nodes as unknown[]).map(String) : [];

  // Sólo lo que el caso AFIRMA, no las treinta variables del contrato: comparar
  // campo a campo lo que se esperaba con lo que salió es lo que resuelve la duda.
  const asserted = Object.keys(expected);
  const passed = display(caseRun, 'resultStatus') === 'PASS';

  return (
    <article className={`case-run${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="case-run-head"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <StatusBadge value={display(caseRun, 'resultStatus')} />
        <span className="case-run-code mono">
          {display(testCase, 'caseCode') || display(caseRun, 'testCaseId')}
        </span>
        <span className="case-run-name">{display(testCase, 'testName')}</span>
        <span className="case-run-time">{display(caseRun, 'durationMs')} ms</span>
        <ChevronDown
          size={15}
          className={open ? 'case-run-chevron open' : 'case-run-chevron'}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="case-run-body">
          <section>
            <h4>Lo que se comprobó</h4>
            <table className="case-run-table">
              <thead>
                <tr>
                  <th scope="col">Campo</th>
                  <th scope="col">Esperado</th>
                  <th scope="col">Obtenido</th>
                </tr>
              </thead>
              <tbody>
                {asserted.map((field) => {
                  const want = JSON.stringify(expected[field]);
                  const got = JSON.stringify(actual[field]);
                  return (
                    <tr key={field} className={want === got ? undefined : 'case-run-mismatch'}>
                      <td className="mono">{field}</td>
                      <td className="mono">{want}</td>
                      <td className="mono">{got ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!passed && caseRun.errorJson ? (
              <p className="case-run-error">{JSON.stringify(caseRun.errorJson)}</p>
            ) : null}
          </section>

          {nodes.length ? (
            <section>
              <h4>
                <Route size={14} aria-hidden /> Camino que siguió
              </h4>
              <ol className="case-run-path">
                {nodes.map((node, index) => (
                  <li key={`${node}-${index}`} className="mono">
                    {node}
                  </li>
                ))}
              </ol>
              {trace.terminal ? (
                <p className="case-run-terminal">
                  <Flag size={13} aria-hidden /> Terminó en <b>{String(trace.terminal)}</b>
                </p>
              ) : null}
            </section>
          ) : null}

          <section>
            <h4>Con qué entró</h4>
            {/* Las entradas de un caso real son decenas: se listan sólo las que
                el escenario cambió respecto de lo demás sería ilegible, así que
                se muestran todas pero en una rejilla compacta y recorrible. */}
            <dl className="case-run-inputs">
              {Object.entries(inputs).map(([key, value]) => (
                <div key={key}>
                  <dt className="mono">{key}</dt>
                  <dd className="mono">{JSON.stringify(value)}</dd>
                </div>
              ))}
            </dl>
          </section>

          {asRows(caseRun.assertions).length ? (
            <section>
              <h4>Aserciones</h4>
              <ul className="case-run-assertions">
                {asRows(caseRun.assertions).map((entry, index) => (
                  <li key={index} className={entry.passed ? 'is-pass' : 'is-fail'}>
                    <code>{display(entry, 'assertionPath')}</code> · {display(entry, 'operator')}{' '}
                    <b>{JSON.stringify(entry.expectedJson)}</b>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
