import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../../api/http-client';
import {
  fetchDashboard,
  isFailedExecution,
  isPending,
  metricText,
  qualityFrom,
} from './dashboard.api';
import { isHealthy } from './PlatformHealthPanels';

vi.mock('../../api/http-client', () => ({ apiRequest: vi.fn() }));
const mockedApiRequest = vi.mocked(apiRequest);

const page = (items: unknown[], total: number) => ({
  items,
  page: 1,
  pageSize: 25,
  total,
  totalPages: 1,
  hasNextPage: false,
});

beforeEach(() => {
  mockedApiRequest.mockReset();
});

describe('qualityFrom', () => {
  it('calcula el porcentaje sobre las ejecuciones concluidas', () => {
    expect(qualityFrom(25, 22)).toEqual({ concluded: 47, passRate: 53.2 });
  });

  it('no inventa un 0 % cuando todavía no concluyó ninguna', () => {
    expect(qualityFrom(0, 0)).toEqual({ concluded: 0, passRate: null });
  });

  it('marca la señal entera como no disponible si falta cualquiera de los dos', () => {
    expect(qualityFrom(null, 3)).toEqual({ concluded: null, passRate: null });
    expect(qualityFrom(3, null)).toEqual({ concluded: null, passRate: null });
  });
});

describe('salud de las dependencias', () => {
  it('acepta el vocabulario libre con el que el motor describe cada sonda', () => {
    // El backend real responde `{database: "ok", cache: "redis"}`: "redis" es el
    // proveedor, no un fallo. Marcarlo en rojo sería una falsa alarma.
    expect(isHealthy('OK')).toBe(true);
    expect(isHealthy('REDIS')).toBe(true);
    expect(isHealthy('UP')).toBe(true);
  });

  it('sólo señala las dependencias que se declaran caídas', () => {
    expect(isHealthy('DOWN')).toBe(false);
    expect(isHealthy('ERROR')).toBe(false);
    expect(isHealthy('TIMEOUT')).toBe(false);
    expect(isHealthy('—')).toBe(false);
  });
});

describe('clasificación de filas', () => {
  it('reconoce una ejecución fallida por estado o por desenlace', () => {
    expect(isFailedExecution({ status: 'FAILED' })).toBe(true);
    expect(isFailedExecution({ outcome: 'ERROR' })).toBe(true);
    expect(isFailedExecution({ status: 'COMPLETED' })).toBe(false);
  });

  it('reconoce el trabajo que sigue esperando a una persona', () => {
    expect(isPending({ status: 'PENDING' })).toBe(true);
    expect(isPending({ state: 'IN_REVIEW' })).toBe(true);
    expect(isPending({ status: 'RESOLVED' })).toBe(false);
  });
});

describe('fetchDashboard', () => {
  it('lee los totales reales de cada recurso', async () => {
    mockedApiRequest.mockImplementation((path: string) => {
      if (path.startsWith('/v1/artifacts')) return Promise.resolve(page([], 12));
      if (path.startsWith('/v1/audit/executions')) {
        return Promise.resolve(page([{ id: '1', status: 'FAILED' }], 128));
      }
      if (path.startsWith('/v1/environments')) return Promise.resolve([{ code: 'DEV' }]);
      // La calidad se cuenta desde la bitácora: un evento por ejecución de
      // prueba terminada, filtrado por tipo.
      if (path.includes('TEST_RUN_PASSED')) return Promise.resolve(page([], 30));
      if (path.includes('TEST_RUN_FAILED')) return Promise.resolve(page([], 10));
      return Promise.resolve(page([], 0));
    });

    const snapshot = await fetchDashboard();

    expect(snapshot.artifacts.total).toBe(12);
    expect(snapshot.executions.total).toBe(128);
    expect(snapshot.environments.total).toBe(1);
    expect(snapshot.testQuality).toEqual({ concluded: 40, passRate: 75 });
    expect(snapshot.failedExecutions).toHaveLength(1);
  });

  it('degrada a "no disponible" el recurso que el backend no expone', async () => {
    mockedApiRequest.mockImplementation((path: string) =>
      path.includes('/v1/audit/events')
        ? Promise.reject(new Error('404'))
        : Promise.resolve(page([], 3)),
    );

    const snapshot = await fetchDashboard();

    // Un cero aquí se leería como "ninguna prueba ejecutada", que es otra cosa.
    expect(snapshot.testQuality).toEqual({ concluded: null, passRate: null });
    expect(metricText(snapshot.artifacts)).toBe('3');
    // El resto del panel sigue mostrando datos verdaderos.
    expect(snapshot.artifacts.total).toBe(3);
  });

  it('no deja caer el panel entero si falla todo el backend', async () => {
    mockedApiRequest.mockRejectedValue(new Error('sin red'));

    const snapshot = await fetchDashboard();

    expect(snapshot.artifacts.total).toBeNull();
    expect(snapshot.failedExecutions).toEqual([]);
  });
});
