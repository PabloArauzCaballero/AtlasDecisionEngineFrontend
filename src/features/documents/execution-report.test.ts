import { describe, expect, it } from 'vitest';
import { buildExecutionReport, executionReportFileName } from './execution-report';

const ejecucion = {
  requestId: 'REQ-2026-0007',
  artifactCode: 'SCORING_BNPL',
  versionNumber: 3,
  environmentCode: 'prod',
  principalId: 'usr-1',
  createdAt: '2026-08-26T12:00:00.000Z',
  status: 'COMPLETED',
  outcome: 'APPROVED',
  durationMs: 143,
  variables: [
    { variableCode: 'ingreso_mensual', value: 8500, sensitivityClass: 'PII', sourceType: 'INPUT' },
    { variableCode: 'score', value: 712, sensitivityClass: 'INTERNAL', sourceType: 'MODEL' },
  ],
  traceSteps: [
    { nodeKey: 'inicio', branchTaken: 'ok', durationUs: 120 },
    { nodeKey: 'corte_score', evaluation: 'score >= 650', durationUs: 340 },
  ],
};

describe('buildExecutionReport', () => {
  it('enmascara en el PDF exactamente lo que la pantalla enmascara', () => {
    const informe = buildExecutionReport(ejecucion);
    const tabla = informe.sections.find((seccion) => seccion.title === 'Variables resueltas')?.table;

    expect(tabla?.rows[0]).toMatchObject({ variable: 'ingreso_mensual', valor: '•••' });
    // La que no está clasificada sí viaja con su valor: enmascarar todo sería inútil.
    expect(tabla?.rows[1]).toMatchObject({ variable: 'score', valor: '712' });
    expect(JSON.stringify(informe)).not.toContain('8500');
  });

  it('avisa de que hay datos personales ocultos', () => {
    const informe = buildExecutionReport(ejecucion);
    expect(informe.notices?.some((aviso) => aviso.level === 'caution')).toBe(true);
  });

  it('marca como crítico el desenlace que no aprueba', () => {
    const informe = buildExecutionReport({ ...ejecucion, outcome: 'REJECTED' });
    expect(informe.notices?.some((aviso) => aviso.level === 'critical')).toBe(true);
  });

  it('no inventa secciones cuando la ejecución viene vacía', () => {
    const informe = buildExecutionReport({});
    // Metadatos siempre; variables y traza sólo si existen. El contrato exige al menos una.
    expect(informe.sections).toHaveLength(1);
    expect(informe.sections[0].title).toBe('Metadatos de contexto');
  });

  it('respeta los topes del contrato en tablas largas', () => {
    const variables = Array.from({ length: 2_500 }, (_, indice) => ({
      variableCode: `v${indice}`,
      value: indice,
    }));
    const informe = buildExecutionReport({ ...ejecucion, variables });
    const tabla = informe.sections.find((seccion) => seccion.title === 'Variables resueltas')?.table;
    expect(tabla?.rows.length).toBe(2_000);
  });

  it('el archivo lleva el identificador de petición, saneado', () => {
    expect(executionReportFileName(ejecucion)).toBe('ejecucion-REQ-2026-0007.pdf');
    expect(executionReportFileName({ requestId: '../../etc/passwd' })).toBe(
      'ejecucion-etc-passwd.pdf',
    );
  });
});
