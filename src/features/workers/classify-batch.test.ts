import { clasificarTanda, type VeredictoCategoria } from './classify-batch';
import { createSemanticRunBatch, fetchSemanticRunStatuses } from './workers.api';

vi.mock('./workers.api', async () => {
  const real = await vi.importActual<typeof import('./workers.api')>('./workers.api');
  return {
    ...real,
    createSemanticRunBatch: vi.fn(),
    fetchSemanticRunStatuses: vi.fn(),
  };
});

const crear = vi.mocked(createSemanticRunBatch);
const consultar = vi.mocked(fetchSemanticRunStatuses);

/**
 * El bucle que sigue una tanda de glosas, y sobre todo CUÁNDO se rinde.
 *
 * El defecto que esto cierra no era un fallo visible: era una espera sin final.
 * Una glosa que el motor no resolvía dejaba su fila girando indefinidamente, y
 * con ella la tabla a medio clasificar y a quien la miraba sin nada que hacer.
 * Ahora se suelta con motivo y la pantalla vuelve a ser utilizable.
 *
 * Lo delicado es no pasarse: soltar demasiado pronto convierte una cola larga en
 * una avalancha de revisiones que nadie tiene que revisar. Por eso las dos
 * pruebas centrales son la que suelta y la que NO suelta.
 */

function ejecucion(requestId: string, status: string, result?: unknown) {
  return {
    requestId,
    status,
    result: result ?? null,
    errorCode: null,
    errorMessage: null,
  } as unknown as Awaited<ReturnType<typeof fetchSemanticRunStatuses>>[number];
}

/** Recoge todo lo anotado durante la tanda, con el último veredicto por glosa. */
function recolector() {
  const visto: Record<string, VeredictoCategoria> = {};
  return {
    visto,
    anotar: (nuevos: Readonly<Record<string, VeredictoCategoria>>) => Object.assign(visto, nuevos),
  };
}

const CASOS = [{ clave: 'GLOSA|DEBIT', texto: 'DEBITO PAGO QR' }];

beforeEach(() => {
  vi.clearAllMocks();
  crear.mockResolvedValue([{ requestId: 'run-1' }] as never);
});

describe('una glosa que tarda se suelta a revisión', () => {
  it('deja de esperarla al vencer el plazo, con motivo TIMEOUT', async () => {
    // Corre eternamente: sin corte, el bucle no terminaría nunca.
    consultar.mockResolvedValue([ejecucion('run-1', 'RUNNING')]);
    const { visto, anotar } = recolector();
    let reloj = 0;

    await clasificarTanda({
      casos: CASOS,
      claveDe: (texto) => `k:${texto}`,
      hayQueParar: () => false,
      anotar,
      // Cada consulta avanza el reloj un segundo: al quinto vence el plazo.
      ahora: () => (reloj += 1_000),
      presupuestoMs: 3_000,
    });

    expect(visto['GLOSA|DEBIT']).toEqual({ fase: 'revision', motivo: 'TIMEOUT' });
  });

  it('NO la cancela: el motor sigue con ella y acabará en la bandeja', async () => {
    consultar.mockResolvedValue([ejecucion('run-1', 'RUNNING')]);
    const { anotar } = recolector();
    let reloj = 0;

    await clasificarTanda({
      casos: CASOS,
      claveDe: (texto) => `k:${texto}`,
      hayQueParar: () => false,
      anotar,
      ahora: () => (reloj += 1_000),
      presupuestoMs: 3_000,
    });

    // Cancelar tiraría un trabajo que va a terminar. Lo que sobra es la espera,
    // no la ejecución; por eso aquí no se llama a ninguna cancelación.
    expect(crear).toHaveBeenCalledTimes(1);
  });

  it('una que está EN COLA no se manda a revisión aunque pase el plazo', async () => {
    /*
     * Ésta es la prueba que evita la avalancha falsa. Un extracto grande encola
     * seiscientas glosas de golpe y las últimas esperan turno mucho tiempo sin
     * que nada vaya mal: mandarlas a revisión por eso llenaría la bandeja de
     * casos que nadie tiene que mirar, y la volvería inservible.
     */
    let consultas = 0;
    consultar.mockImplementation(async () => {
      consultas += 1;
      // Seis sondeos en cola —muy por encima del plazo— y luego termina bien.
      if (consultas <= 6) return [ejecucion('run-1', 'QUEUED')];
      return [ejecucion('run-1', 'SUCCEEDED', { status: 'MATCH', matches: [], categoryPaths: {} })];
    });
    const { visto, anotar } = recolector();
    let reloj = 0;

    await clasificarTanda({
      casos: CASOS,
      claveDe: (texto) => `k:${texto}`,
      hayQueParar: () => false,
      anotar,
      ahora: () => (reloj += 1_000),
      presupuestoMs: 3_000,
    });

    expect(visto['GLOSA|DEBIT'].fase).toBe('listo');
  });
});

describe('lo que ya funcionaba sigue funcionando', () => {
  it('una glosa que resuelve rápido devuelve su categoría', async () => {
    consultar.mockResolvedValue([
      ejecucion('run-1', 'SUCCEEDED', {
        status: 'MATCH',
        matches: [{ categoryCode: 'GASTOS.QR', confidence: 0.91 }],
        categoryPaths: { 'GASTOS.QR': ['Gastos', 'QR'] },
      }),
    ]);
    const { visto, anotar } = recolector();

    await clasificarTanda({
      casos: CASOS,
      claveDe: (texto) => `k:${texto}`,
      hayQueParar: () => false,
      anotar,
    });

    expect(visto['GLOSA|DEBIT']).toMatchObject({
      fase: 'listo',
      estado: 'MATCH',
      categoria: 'GASTOS.QR',
      confianza: 0.91,
    });
  });

  it('un fallo real sigue siendo un fallo, no una revisión', async () => {
    // La distinción entera depende de esto: se actúa distinto sobre cada uno.
    consultar.mockResolvedValue([ejecucion('run-1', 'FAILED')]);
    const { visto, anotar } = recolector();

    await clasificarTanda({
      casos: CASOS,
      claveDe: (texto) => `k:${texto}`,
      hayQueParar: () => false,
      anotar,
    });

    expect(visto['GLOSA|DEBIT'].fase).toBe('fallido');
  });

  it('la clave de idempotencia viaja con cada glosa', async () => {
    // Es lo que impide que un doble clic abra dos ejecuciones de lo mismo.
    consultar.mockResolvedValue([ejecucion('run-1', 'SUCCEEDED', { status: 'UNKNOWN' })]);
    const { anotar } = recolector();

    await clasificarTanda({
      casos: CASOS,
      claveDe: (texto) => `tanda-7:${texto}`,
      hayQueParar: () => false,
      anotar,
    });

    expect(crear).toHaveBeenCalledWith([
      { text: 'DEBITO PAGO QR', idempotencyKey: 'tanda-7:DEBITO PAGO QR' },
    ]);
  });
});
