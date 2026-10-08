import { describe, expect, it } from 'vitest';
import { canAccessPath } from './route-access';

/**
 * Cada cargo interno de Core (`internal-rbac.roles.ts`) con lo que debe poder abrir en el Motor.
 *
 * La sesión trae el código de Core sin traducir. Hasta el 2026-10-08 varios cargos entraban con
 * cero roles efectivos y el portal les salía vacío; esta tabla es la que lo impide.
 */
const CASOS: ReadonlyArray<[cargo: string, debeVer: string[], noDebeVer: string[]]> = [
  [
    'RISK_ANALYST',
    ['/artifacts', '/executions', '/manual-reviews', '/model-monitoring'],
    ['/graph-editor'],
  ],
  ['RISK_MANAGER', ['/reviews', '/model-monitoring', '/decision-quality'], ['/graph-editor']],
  ['FRAUD_ANALYST', ['/graph-editor', '/manual-reviews', '/reviews'], []],
  [
    'COMPLIANCE_MANAGER',
    ['/executions', '/audit-events', '/data-subject-requests'],
    ['/graph-editor'],
  ],
  ['AUDITOR_READONLY', ['/executions', '/audit-events', '/artifacts'], ['/graph-editor']],
  [
    'OPERATIONS_MANAGER',
    ['/manual-reviews', '/executions', '/decision-quality'],
    ['/graph-editor'],
  ],
  ['OPERATIONS_ANALYST', ['/manual-reviews'], ['/graph-editor']],
  ['MERCHANT_OPERATIONS', ['/manual-reviews'], ['/graph-editor']],
  [
    'FINANCE_MANAGER',
    ['/decision-quality', '/model-monitoring', '/executions'],
    ['/graph-editor', '/manual-reviews'],
  ],
  ['EXECUTIVE_READONLY', ['/decision-quality', '/model-monitoring'], ['/graph-editor']],
  ['QA_ENGINEER', ['/graph-editor', '/test-suites', '/simulator'], []],
];

describe('cargos de Core en el Motor', () => {
  it.each(CASOS)('%s abre lo suyo y nada de autoría ajena', (cargo, debeVer, noDebeVer) => {
    for (const ruta of debeVer) expect(canAccessPath(ruta, [cargo])).toBe(true);
    for (const ruta of noDebeVer) expect(canAccessPath(ruta, [cargo])).toBe(false);
  });

  it('cobranza no tiene nada que hacer en el Motor', () => {
    expect(canAccessPath('/executions', ['COLLECTIONS_AGENT'])).toBe(false);
  });
});
