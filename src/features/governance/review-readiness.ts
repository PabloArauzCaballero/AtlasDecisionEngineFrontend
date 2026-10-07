import { ARTIFACT_STATUS_LABEL } from '../../resources/artifact-status';
import { asRecord, asRows, display, type UnknownRecord } from '../../utils/records';

/**
 * Qué le falta a una versión para poder enviarse a revisión, y a dónde ir a arreglarlo.
 *
 * El motor exige tres cosas (`GovernanceService.submitForReview` + `verifyBlockingTests`): que esté `COMPILED`,
 * que tenga al menos una suite BLOQUEANTE con una corrida en verde, y que esa corrida cubra el 80 % de los nodos.
 * Cuando falta algo responde un único `BLOCKING_TESTS_NOT_PASSED`, y el portal lo traducía por «sus pruebas no
 * están en verde: ejecútalas» también cuando la versión NO TENÍA ninguna suite (visto en TEST el 2026-10-07 con
 * IDENTIDAD_CARNET_MOVIL 1.2.1): no había nada que ejecutar, y el aviso no llevaba a ningún sitio.
 *
 * Aquí se calcula ANTES de pulsar, con lo que el motor ya publica de cada suite, y cada punto pendiente trae el
 * enlace a la pantalla donde se resuelve.
 */
export const MIN_NODE_COVERAGE = 80;

export interface ReadinessItem {
  key: string;
  ok: boolean;
  title: string;
  detail: string;
  /** A dónde ir a resolverlo. Sólo en los puntos pendientes. */
  action?: { label: string; href: string };
}

export interface ReviewReadiness {
  ready: boolean;
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

/** Cobertura de NODOS de la corrida, en porcentaje, y los nodos que faltan; `null` si la corrida no la trae. */
function nodeCoverage(run: UnknownRecord): { percentage: number; missing: string[] } | null {
  const node = asRows(run.coverage).find((item) => item.coverageType === 'NODE');
  if (!node) return null;
  const missing = asRecord(node.detailsJson).missing;
  return {
    percentage: Number(node.coveragePercentage ?? 0),
    missing: Array.isArray(missing) ? missing.map(String) : [],
  };
}

function suiteItem(suite: UnknownRecord, index: number): ReadinessItem {
  const id = display(suite, 'id');
  const name = display(suite, 'suiteCode', 'name');
  const cases = asRows(suite.cases).length;
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
  if (status !== 'PASSED') {
    return {
      key,
      ok: false,
      title,
      detail: `La última corrida (${runId}) no pasó: quedó en ${status}.`,
      action: { label: 'Ver qué casos fallaron', href: `/test-runs/${encodeURIComponent(runId)}` },
    };
  }
  const coverage = nodeCoverage(run);
  if (coverage && coverage.percentage < MIN_NODE_COVERAGE) {
    const faltan = coverage.missing.slice(0, 4).join(', ');
    return {
      key,
      ok: false,
      title,
      detail: `Pasa, pero sólo recorre el ${String(Math.round(coverage.percentage))} % de los nodos y se exige el ${String(MIN_NODE_COVERAGE)} %.${faltan ? ` Sin probar: ${faltan}${coverage.missing.length > 4 ? '…' : ''}.` : ''}`,
      action: {
        label: 'Ver los nodos sin cubrir',
        href: `/test-runs/${encodeURIComponent(runId)}/coverage`,
      },
    };
  }
  return {
    key,
    ok: true,
    title,
    detail: `${String(cases)} caso(s) en verde${coverage ? ` · ${String(Math.round(coverage.percentage))} % de los nodos` : ''} (corrida ${runId}).`,
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
        : 'Esta versión no tiene ninguna suite de pruebas. Las pruebas NO se heredan de la versión anterior: hay que crearlas para ésta y ejecutarlas.',
      action: {
        label: 'Crear las pruebas de esta versión',
        href: `/artifact-versions/${encodeURIComponent(versionId)}/test-suites`,
      },
    });
  } else {
    blocking.forEach((suite, index) => items.push(suiteItem(suite, index)));
  }
  return { ready: items.every((item) => item.ok), items };
}
