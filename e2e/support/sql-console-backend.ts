import type { Page } from '@playwright/test';
import { EMPTY_PAGE, MOCK_SESSION } from './backend-mock';

/**
 * Motor simulado para la consola de consultas SQL.
 *
 * El simulado general devuelve listados VACÍOS, y con él la consola pinta un explorador sin
 * datasets, un editor sin autocompletado y un panel de resultados que nunca sale de su
 * estado inicial: se estaría midiendo la cabecera creyendo medir la vista. Éste sirve un
 * catálogo con volumen y responde a las tres operaciones reales.
 *
 * **Reproduce los CUATRO desenlaces**, no sólo el bueno: una consulta que devuelve filas,
 * una rechazada por la guardia (422), una que agota el reloj (400) y un resultado cortado
 * por el tope de filas. Los tres últimos son justo los que la pantalla tiene que saber
 * distinguir, y contra un simulado que siempre responde 200 con filas no se prueba ninguno.
 */

export const SQL_CATALOG = {
  datasets: [
    {
      name: 'decisiones',
      description: 'Qué decidió el motor, cuándo, con qué versión y por qué.',
      tables: [
        {
          name: 'ejecuciones',
          description: 'Una fila por decisión tomada.',
          grain: 'Una fila = una decisión ejecutada por el motor.',
          columns: [
            { name: 'ejecucion_id', kind: 'identificador', description: 'Identificador.' },
            { name: 'artefacto', kind: 'texto', description: 'Código del artefacto.' },
            { name: 'estado', kind: 'texto', description: 'APPROVED, REJECTED, ERROR…' },
            { name: 'duracion_ms', kind: 'entero', description: 'Duración en milisegundos.' },
            { name: 'ejecutada_en', kind: 'fecha', description: 'Momento de la ejecución.' },
          ],
        },
        {
          name: 'motivos',
          description: 'Por qué se decidió así.',
          grain: 'Una fila = un motivo emitido por una ejecución.',
          columns: [
            { name: 'ejecucion_id', kind: 'identificador', description: 'Ejecución.' },
            { name: 'codigo', kind: 'texto', description: 'Código del motivo.' },
          ],
        },
      ],
    },
    {
      name: 'desenlaces',
      description: 'Qué pasó DESPUÉS de decidir.',
      tables: [
        {
          name: 'observaciones',
          description: 'El desenlace observado de cada decisión.',
          grain: 'Una fila = un desenlace observado.',
          columns: [
            { name: 'observacion_id', kind: 'identificador', description: 'Identificador.' },
            { name: 'desenlace', kind: 'texto', description: 'GOOD, BAD, INDETERMINATE.' },
            { name: 'monto', kind: 'numero', description: 'Monto asociado.' },
          ],
        },
      ],
    },
  ],
  limits: { maxRows: 10_000, timeoutMs: 12_000, maxStatementBytes: 65_536 },
};

const ESTIMATE = {
  estimatedRows: 1840,
  estimatedBytes: 147_200,
  planCost: 1240.55,
  scannedRelations: ['decisiones.ejecuciones'],
};

const RESULT_OK = {
  columns: [
    { name: 'artefacto', kind: 'texto' },
    { name: 'estado', kind: 'texto' },
    { name: 'decisiones', kind: 'entero' },
    { name: 'ultima', kind: 'fecha' },
    { name: 'monto', kind: 'numero' },
  ],
  rows: [
    ['SCORING_CREDITO', 'APPROVED', '18420', '2026-08-13T18:20:00.000Z', '1240.55'],
    ['SCORING_CREDITO', 'REJECTED', '4102', '2026-08-13T17:02:00.000Z', '880.10'],
    // `null` en una celda: la rejilla tiene que distinguirlo de la cadena vacía, que es
    // donde una consulta con LEFT JOIN se lee al revés de lo que dice.
    ['TRIAGE_FRAUDE', 'MANUAL_REVIEW', '73', null, null],
  ],
  rowCount: 3,
  durationMs: 184,
  truncated: false,
  estimate: ESTIMATE,
};

const RESULT_TRUNCADO = {
  ...RESULT_OK,
  truncated: true,
  rowCount: 3,
  estimate: { ...ESTIMATE, estimatedRows: 412_000 },
};

/**
 * Un resultado LARGO, para medir que la rejilla se desplaza dentro de su panel.
 *
 * Trescientas filas y no tres: con tres, la tabla cabe en cualquier alto y el
 * desbordamiento —que es justo lo que hay que provocar— no llega a ocurrir. Una
 * prueba de scroll sobre un resultado que cabe pasa igual estando rota.
 */
const RESULT_LARGO = {
  ...RESULT_OK,
  rows: Array.from({ length: 300 }, (_, i) => [
    `ARTEFACTO_${String(i).padStart(3, '0')}`,
    i % 3 === 0 ? 'APPROVED' : 'REJECTED',
    String(1000 + i),
    '2026-08-13T18:20:00.000Z',
    `${i}.50`,
  ]),
  rowCount: 300,
};

const HISTORY = {
  entries: [
    {
      id: '3312',
      statement: 'SELECT estado, count(*) FROM decisiones.ejecuciones GROUP BY 1',
      outcome: 'SUCCEEDED',
      errorCode: null,
      rowCount: 2,
      durationMs: 184,
      truncated: false,
      relations: ['decisiones.ejecuciones'],
      executedAt: '2026-08-14T09:00:00.000Z',
    },
    {
      id: '3311',
      statement: 'DELETE FROM decisiones.ejecuciones',
      outcome: 'REJECTED',
      errorCode: 'SQL_NOT_A_QUERY',
      rowCount: null,
      durationMs: null,
      truncated: false,
      relations: [],
      executedAt: '2026-08-14T08:58:00.000Z',
    },
  ],
};

/** Qué debe responder `POST /query` según lo que traiga la consulta. */
function respuestaDeConsulta(statement: string) {
  if (/DELETE|DROP|UPDATE|INSERT/i.test(statement)) {
    return {
      status: 422,
      json: {
        code: 'SQL_NOT_A_QUERY',
        message: 'La consola sólo ejecuta consultas: empieza por SELECT o por WITH.',
      },
    };
  }
  if (/pg_sleep|LENTA/i.test(statement)) {
    return {
      status: 400,
      json: {
        code: 'SQL_TIMEOUT',
        message: 'La consulta superó el límite de 12 segundos. Acota el rango de fechas.',
      },
    };
  }
  if (/TRUNCADA/i.test(statement)) return { status: 200, json: RESULT_TRUNCADO };
  if (/MUCHAS_FILAS/i.test(statement)) return { status: 200, json: RESULT_LARGO };
  return { status: 200, json: RESULT_OK };
}

export async function mockSqlConsoleBackend(page: Page): Promise<void> {
  await page.route('**/health/**', (route) => route.fulfill({ json: { status: 'UP' } }));
  await page.route('**/v1/**', async (route) => {
    const request = route.request();
    const url = request.url();

    if (url.includes('/v1/session/')) return route.fulfill({ json: MOCK_SESSION });
    if (url.includes('/v1/sql-console/catalog')) return route.fulfill({ json: SQL_CATALOG });
    if (url.includes('/v1/sql-console/history')) return route.fulfill({ json: HISTORY });
    if (url.includes('/v1/sql-console/validate')) {
      return route.fulfill({ json: { valid: true, violations: [], estimate: ESTIMATE } });
    }
    if (url.includes('/v1/sql-console/query')) {
      const body = request.postDataJSON() as { statement?: string } | null;
      return route.fulfill(respuestaDeConsulta(body?.statement ?? ''));
    }
    return route.fulfill({ json: EMPTY_PAGE });
  });
}
