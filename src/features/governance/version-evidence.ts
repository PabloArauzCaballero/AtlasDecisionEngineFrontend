import { asRecord, asRows, display, type UnknownRecord } from '../../utils/records';
import type { GateRow } from './approval-gates';

/**
 * Evidencia real de una versión, derivada de lo que el backend SÍ publica.
 *
 * El endpoint de la solicitud de aprobación no devuelve gates: `getRequest()`
 * incluye la versión, el artefacto y los pasos con sus decisiones, y nada más.
 * Por eso la pantalla no podía afirmar que la compilación o las suites
 * bloqueantes hubiesen pasado — y decirlo era lo correcto.
 *
 * Pero la evidencia existe, sólo que en otra puerta:
 * `GET /v1/artifact-versions/:versionId/test-suites` está documentado como
 * «List suites and recent run evidence for a version» y devuelve cada suite con
 * `isBlocking` y sus corridas recientes. Aquí se traduce a las mismas filas que
 * consume el panel, sin inventar ninguna: una suite sin corridas se queda en
 * «SIN CORRIDA», que no es un estado de aprobación y por tanto cuenta como
 * pendiente.
 */

/** Estados de corrida en orden de recencia preferida: la última que terminó. */
function latestRun(suite: UnknownRecord): UnknownRecord | null {
  const runs = asRows(suite.runs);
  if (!runs.length) return null;
  // El backend ya las ordena, pero no se depende de ello: se elige por fecha y,
  // a falta de fecha, por id descendente.
  const sorted = [...runs].sort((a, b) => {
    const dateA = String(a.finishedAt ?? a.queuedAt ?? '');
    const dateB = String(b.finishedAt ?? b.queuedAt ?? '');
    if (dateA !== dateB) return dateA < dateB ? 1 : -1;
    return String(b.id ?? '').localeCompare(String(a.id ?? ''));
  });
  return asRecord(sorted[0]);
}

function suiteRow(suite: UnknownRecord, index: number): GateRow {
  const run = latestRun(suite);
  const blocking = suite.isBlocking === true;
  const code = display(suite, 'suiteCode', 'name');
  const cases = asRows(suite.cases).length;

  const detail = [
    blocking ? 'Suite bloqueante' : 'Suite informativa',
    cases ? `${cases} ${cases === 1 ? 'caso' : 'casos'}` : null,
    run ? `corrida ${display(run, 'id')}` : 'sin corridas registradas',
  ]
    .filter(Boolean)
    .join(' · ');

  // `display()` devuelve «—» cuando no hay dato, y «—» es una cadena con
  // contenido: con `||` dos suites sin id compartirían la clave `suite-—` y
  // React las trataría como la misma fila. El índice desempata.
  const id = display(suite, 'id');
  return {
    key: `suite-${id === '—' ? index : id}`,
    label: code === '—' ? `Suite ${index + 1}` : code,
    // `null` no: el panel distingue «no llegó nada» de «llegó y no ha corrido».
    status: run ? display(run, 'status') : 'SIN CORRIDA',
    detail,
  };
}

/**
 * Fila de compilación, y sólo con el estado que reportó el compilador.
 *
 * Deliberadamente NO se deduce de `canonicalChecksum`: ese hash es la forma
 * canónica del grafo y existe también en un borrador que nunca se compiló, así
 * que darlo por PASSED sería exactamente el error que este módulo existe para
 * no repetir. La única evidencia válida es `compiledArtifacts[].compileStatus`,
 * que es lo que el compilador dijo de verdad.
 */
function compileRow(version: UnknownRecord): GateRow | null {
  const compiled = asRows(version.compiledArtifacts);
  if (!compiled.length) return null;

  // La más reciente: el backend ya las ordena por `compiledAt` descendente.
  const latest = asRecord(compiled[0]);
  const compiler = display(latest, 'compilerVersion');
  return {
    key: 'compilation',
    label: 'Compilación determinista',
    status: display(latest, 'compileStatus'),
    detail: compiler === '—' ? null : `compilador ${compiler}`,
  };
}

/** Traduce la evidencia de la versión a filas de gate. Vacío si no hay ninguna. */
export function evidenceGateRows(version: UnknownRecord, suites: UnknownRecord[]): GateRow[] {
  const rows: GateRow[] = [];
  const compile = compileRow(version);
  if (compile) rows.push(compile);
  // Las bloqueantes primero: son las que impiden firmar.
  const ordered = [...suites].sort(
    (a, b) => Number(b.isBlocking === true) - Number(a.isBlocking === true),
  );
  ordered.forEach((suite, index) => rows.push(suiteRow(suite, index)));
  return rows;
}
