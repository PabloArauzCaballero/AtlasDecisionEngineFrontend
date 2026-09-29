import { describe, expect, it } from 'vitest';
import { resources } from './resource.config';

/**
 * Lo que el listado promete tiene que existir en el motor. El motor valida con `whitelist` +
 * `forbidNonWhitelisted`: un parámetro que no declara es un 400, y uno que declara pero ignora es
 * un filtro que no filtra. Las listas de abajo se copian a mano del DTO/modelo del motor a
 * propósito: si allí cambia algo, esta prueba obliga a tocar la pantalla a la vez.
 */
const PARAMS_DE_LA_COLA = ['status', 'assignedTo', 'queueCode', 'search', 'page', 'pageSize'];
const PARAMS_DE_LA_BITACORA = [
  'search',
  'eventType',
  'aggregateType',
  'actorId',
  'from',
  'to',
  'page',
  'pageSize',
];
/** Campos de `DecisionAuditEvent` (prisma/schema.prisma): no hay IP ni `createdAt`. */
const CAMPOS_DEL_EVENTO = [
  'id',
  'tenantId',
  'eventType',
  'aggregateType',
  'aggregateId',
  'actorId',
  'requestId',
  'payloadJson',
  'previousHash',
  'eventHash',
  'hashKeyId',
  'canonicalPayload',
  'occurredAt',
];
/** Campos del caso de revisión manual (`DecisionManualReviewCase`) más su ejecución. */
const CAMPOS_DEL_CASO = [
  'id',
  'caseCode',
  'queueCode',
  'priority',
  'status',
  'assignedTo',
  'dueAt',
  'createdAt',
  'resolvedAt',
  'requestId',
  'businessOutcome',
];

function paramsDe(key: string): string[] {
  const recurso = resources[key];
  return [recurso?.filterParam, ...(recurso?.filters ?? []).map((filtro) => filtro.param)].filter(
    (param): param is string => Boolean(param),
  );
}

describe('la cola de revisión manual', () => {
  it('«Buscar caso» manda `search`, que el motor busca en el código y en el request ID', () => {
    expect(resources['manual-reviews']?.filterParam).toBe('search');
    expect(resources['manual-reviews']?.filterHelp).toMatch(/identificador del caso/);
    expect(resources['manual-reviews']?.filterHelp).toMatch(/request ID/);
  });

  it('sólo manda parámetros que el motor declara', () => {
    for (const param of paramsDe('manual-reviews')) expect(PARAMS_DE_LA_COLA).toContain(param);
  });

  it('pinta el estado del caso, que es lo único que cambia al resolverlo', () => {
    const estado = resources['manual-reviews']?.columns.find((columna) => columna.key === 'status');
    expect(estado?.status).toBe(true);
    expect(estado?.labels?.RESOLVED_DECLINED).toBe('Rechazado');
    expect(estado?.labels?.CANCELLED).toBe('Cancelado');
  });

  it('todas sus columnas leen campos que el motor devuelve', () => {
    for (const columna of resources['manual-reviews']?.columns ?? []) {
      expect(CAMPOS_DEL_CASO).toContain(columna.key);
    }
  });
});

describe('la bitácora de auditoría', () => {
  const bitacora = resources['audit-events'];

  it('sólo manda parámetros que el motor declara', () => {
    for (const param of paramsDe('audit-events')) expect(PARAMS_DE_LA_BITACORA).toContain(param);
  });

  it('todas sus columnas leen campos que el evento guarda (antes: createdAt, ipAddress, currentHash)', () => {
    for (const columna of bitacora?.columns ?? []) {
      expect(CAMPOS_DEL_EVENTO, `columna «${columna.label}»`).toContain(columna.key);
    }
    expect((bitacora?.columns ?? []).map((columna) => columna.key)).toEqual([
      'occurredAt',
      'eventType',
      'actorId',
      'previousHash',
      'eventHash',
    ]);
  });

  it('no promete la IP: el registro no la guarda', () => {
    const texto = JSON.stringify(bitacora).toLowerCase();
    expect(texto).not.toContain('ipaddress');
    expect(texto).not.toMatch(/\bip\b/);
    expect(texto).not.toContain('desde dónde');
  });

  it('el buscador dice por qué campos busca, y son los que el motor recorre', () => {
    expect(bitacora?.filterParam).toBe('search');
    expect(bitacora?.filterPlaceholder).toBe('Evento, objeto, actor o request ID');
    expect(bitacora?.filterHelp).toMatch(/tipo de evento/);
    expect(bitacora?.filterHelp).toMatch(/actor/);
    expect(bitacora?.filterHelp).toMatch(/request ID/);
  });
});

describe('otras ayudas de los listados del motor', () => {
  it('motivos de decisión: la ayuda no promete un «título» que el motor no busca', () => {
    const motivos = resources['reason-codes'];
    expect(motivos?.filterHelp).not.toMatch(/título/i);
    expect(motivos?.filterPlaceholder).toBe('Código o mensaje');
  });

  it('despliegues: la columna Modo nombra los modos reales, no «sombra»', () => {
    const modo = resources.deployments?.columns.find((columna) => columna.key === 'deploymentMode');
    expect(modo?.hint).not.toMatch(/sombra|shadow/i);
    for (const real of ['DIRECT', 'CANARY', 'CHAMPION_CHALLENGER']) {
      expect(modo?.hint).toContain(real);
    }
  });
});
