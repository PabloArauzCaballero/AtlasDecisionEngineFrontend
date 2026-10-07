import { ARTIFACT_STATUS_LABEL } from '../../resources/artifact-status';
import { asRecord, asRows, display, type UnknownRecord } from '../../utils/records';

/**
 * Qué le falta a una versión para poder enviarse a revisión, y a dónde ir a arreglarlo.
 *
 * El motor exige (`GovernanceService.submitForReview` + `judgeBlockingSuites`): que esté `COMPILED`,
 * que cada suite BLOQUEANTE tenga su ÚLTIMA corrida en verde, y que entre todas recorran el 80 %
 * de los nodos. Cuando falta algo responde un único `BLOCKING_TESTS_NOT_PASSED`, y el portal lo
 * traducía por «sus pruebas no están en verde: ejecútalas» también cuando la versión NO TENÍA
 * ninguna suite (visto en TEST el 2026-10-07 con IDENTIDAD_CARNET_MOVIL 1.2.1): no había nada que
 * ejecutar, y el aviso no llevaba a ningún sitio.
 *
 * Aquí se calcula ANTES de pulsar, con lo que el motor ya publica de cada suite. Cada punto
 * pendiente trae el enlace a la pantalla donde se resuelve y, cuando lo que falta son pruebas o
 * cobertura, la opción de GENERARLAS (`POST /artifact-versions/{id}/test-suites/generate`).
 */
export const MIN_NODE_COVERAGE = 80;

export interface ReadinessItem {
  key: string;
  ok: boolean;
  title: string;
  detail: string;
  /** A dónde ir a resolverlo. Sólo en los puntos pendientes. */
  action?: { label: string; href: string };
  /** El pendiente se resuelve generando la suite de cobertura automática. */
  canGenerate?: boolean;
  /** Hay una corrida en marcha: conviene volver a preguntar en unos segundos. */
  running?: boolean;
}

export interface ReviewReadiness {
  ready: boolean;
  /** Alguna suite se está ejecutando ahora mismo. */
  running: boolean;
  items: ReadinessItem[];
}

function latestRun(suite: UnknownRecord): UnknownRecord | null {
  const runs = asRows(suite.runs);
  if (!runs.length) return null;
  const sorted = [...runs].sort((a, b) => {
    const dateA = String(a.finishedAt ?? a.queuedAt ?? '');
    const dateB = String(b.finishedAt ?? b.queuedAt ?? '');
    if (dateA !== dateB) return dateA < dateB ? 1 : -1;
    return Number(b.id ?? 0) - Number(a.id ?? 0);
  });
  return asRecord(sorted[0]);
}

/** Nodos recorridos y sin recorrer de una corrida; `null` si no archivó su cobertura. */
function nodeCoverage(run: UnknownRecord): { covered: string[]; missing: string[] } | null {
  const node = asRows(run.coverage).find((item) => item.coverageType === 'NODE');
  if (!node) return null;
  const details = asRecord(node.detailsJson);
  const list = (value: unknown) => (Array.isArray(value) ? value.map(String) : []);
  return { covered: list(details.covered), missing: list(details.missing) };
}

function isRunning(status: string): boolean {
  return status === 'QUEUED' || status === 'RUNNING';
}

function suiteItem(suite: UnknownRecord, index: number): ReadinessItem {
  const id = display(suite, 'id');
  const name = display(suite, 'suiteCode', 'name');
  // Sólo los activos: regenerar la suite automática desactiva los casos de la generación anterior.
  const cases = asRows(suite.cases).filter((item) => item.isActive !== false).length;
  const key = `suite-${id === '—' ? String(index) : id}`;
  const title = `Pruebas «${name}»`;
  const casesHref = `/test-suites/${encodeURIComponent(id)}/cases`;
  const run = latestRun(suite);

  if (!cases) {
    return {
      key,
      ok: false,
      title,
      detail: 'La suite existe pero no tiene ningún caso: no hay nada que ejecutar.',
      action: { label: 'Añadir casos', href: casesHref },
    };
  }
  if (!run) {
    return {
      key,
      ok: false,
      title,
      detail: `Tiene ${String(cases)} caso(s) y nunca se ejecutó.`,
      action: { label: 'Abrir y ejecutar', href: casesHref },
    };
  }
  const runId = display(run, 'id');
  const status = display(run, 'status');
  if (isRunning(status)) {
    return {
      key,
      ok: false,
      running: true,
      title,
      detail: `Se está ejecutando (corrida ${runId}). Esto se actualiza solo en unos segundos.`,
    };
  }
  if (status !== 'PASSED') {
    return {
      key,
      ok: false,
      title,
      detail: `La última corrida (${runId}) no pasó: quedó en ${status}.`,
      action: { label: 'Ver qué casos fallaron', href: `/test-runs/${encodeURIComponent(runId)}` },
    };
  }
  return {
    key,
    ok: true,
    title,
    detail: `${String(cases)} caso(s) en verde (corrida ${runId}).`,
  };
}

/** La cobertura es del CONJUNTO: se unen los nodos que recorren las suites bloqueantes en verde. */
function coverageItem(versionId: string, blocking: readonly UnknownRecord[]): ReadinessItem | null {
  const covered = new Set<string>();
  const all = new Set<string>();
  let lastRunId: string | null = null;
  for (const suite of blocking) {
    const run = latestRun(suite);
    if (!run || display(run, 'status') !== 'PASSED') continue;
    const coverage = nodeCoverage(run);
    if (!coverage) continue;
    lastRunId = display(run, 'id');
    coverage.covered.forEach((node) => {
      covered.add(node);
      all.add(node);
    });
    coverage.missing.forEach((node) => all.add(node));
  }
  // Sin ninguna corrida en verde no hay cobertura que juzgar: ya lo dice el punto de cada suite.
  if (!all.size || !lastRunId) return null;
  const percentage = Math.round((covered.size / all.size) * 100);
  const missing = [...all].filter((node) => !covered.has(node)).sort();
  if (percentage >= MIN_NODE_COVERAGE) {
    return {
      key: 'coverage',
      ok: true,
      title: 'Cobertura del diagrama',
      detail: `Las pruebas recorren el ${String(percentage)} % de los nodos${missing.length ? ` (sin probar: ${missing.slice(0, 4).join(', ')}${missing.length > 4 ? '…' : ''})` : ''}.`,
    };
  }
  return {
    key: 'coverage',
    ok: false,
    title: 'Cobertura del diagrama',
    detail: `Las pruebas sólo recorren el ${String(percentage)} % de los nodos y se exige el ${String(MIN_NODE_COVERAGE)} %. Sin probar: ${missing.slice(0, 4).join(', ')}${missing.length > 4 ? '…' : ''}.`,
    action: {
      label: 'Ver los nodos sin cubrir',
      href: `/test-runs/${encodeURIComponent(lastRunId)}/coverage`,
    },
    canGenerate: true,
  };
}

/** `status` es el de la versión; `suites`, lo que devuelve `/artifact-versions/{id}/test-suites`. */
export function reviewReadiness(
  versionId: string,
  status: string | null,
  suites: readonly UnknownRecord[],
): ReviewReadiness {
  const items: ReadinessItem[] = [];
  const normalized = (status ?? '').toUpperCase();
  const compiled = normalized === 'COMPILED';
  items.push(
    compiled
      ? { key: 'compiled', ok: true, title: 'Compilada', detail: 'Existe lo que el motor ejecuta.' }
      : {
          key: 'compiled',
          ok: false,
          title: 'Compilada',
          detail: `Está «${ARTIFACT_STATUS_LABEL[normalized] ?? (normalized || 'sin estado')}»: sólo se envía a revisión una versión compilada.`,
          action: {
            label: 'Ir a validar y compilar',
            href: `/artifact-versions/${encodeURIComponent(versionId)}/compile`,
          },
        },
  );

  const blocking = suites.filter((suite) => suite.isBlocking === true);
  if (!blocking.length) {
    items.push({
      key: 'no-blocking-suite',
      ok: false,
      title: 'Pruebas bloqueantes',
      detail: suites.length
        ? 'Tiene suites de prueba, pero ninguna está marcada como bloqueante: el motor exige al menos una.'
        : 'Esta versión no tiene ninguna suite de pruebas. Las pruebas NO se heredan de la versión anterior: hay que crearlas para ésta.',
      action: {
        label: 'Crear las pruebas a mano',
        href: `/artifact-versions/${encodeURIComponent(versionId)}/test-suites`,
      },
      // Sin compilar no hay grafo que recorrer: primero se compila.
      canGenerate: compiled,
    });
  } else {
    blocking.forEach((suite, index) => items.push(suiteItem(suite, index)));
    const coverage = coverageItem(versionId, blocking);
    if (coverage) items.push(coverage);
  }
  return {
    ready: items.every((item) => item.ok),
    running: items.some((item) => item.running),
    items,
  };
}
