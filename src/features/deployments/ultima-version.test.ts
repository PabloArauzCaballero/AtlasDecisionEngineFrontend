import { describe, expect, it } from 'vitest';
import { ultimaVersionPorAlgoritmo } from './ultima-version';

/**
 * El caso medido en TEST el 2026-10-06: el crédito v2.0.1 y el riesgo v1.0.1 estaban APROBADOS y no
 * aparecían en ninguna tabla de Despliegues. Estas pruebas sostienen que la última versión de cada
 * algoritmo se ve SIEMPRE, con lo que está activo y con «Desplegar» sólo cuando corresponde.
 */
const version = (
  id: string,
  artifactCode: string,
  versionNumber: number,
  semanticVersion: string,
  status: string,
) => ({
  id,
  artifactCode,
  artifactName: artifactCode,
  versionNumber,
  semanticVersion,
  status,
});
const activo = (
  artifactVersionId: string,
  ambiente = 'STAGING',
  extra: Record<string, unknown> = {},
) => ({
  artifactVersionId,
  deploymentStatus: 'ACTIVE',
  isActive: true,
  environment: { code: ambiente },
  ...extra,
});

const VERSIONES = [
  version('7', 'ATLAS_BNPL_UNDERWRITING', 2, '2.0.1', 'APPROVED'),
  version('4', 'ATLAS_BNPL_UNDERWRITING', 1, '2.0.0', 'DEPLOYED_TO_STAGING'),
  version('3', 'PARTNER_KYB_REVIEW', 1, '1.0.0', 'DEPLOYED_TO_STAGING'),
  version('8', 'NUEVO', 1, '0.1.0', 'IN_REVIEW'),
];
const DESPLIEGUES = [activo('4'), activo('3')];

describe('ultimaVersionPorAlgoritmo', () => {
  it('una fila por algoritmo, con su última versión por número y no por texto', () => {
    const filas = ultimaVersionPorAlgoritmo(VERSIONES, DESPLIEGUES);
    expect(filas.map((f) => f.artifactCode).sort()).toEqual([
      'ATLAS_BNPL_UNDERWRITING',
      'NUEVO',
      'PARTNER_KYB_REVIEW',
    ]);
    const credito = filas.find((f) => f.artifactCode === 'ATLAS_BNPL_UNDERWRITING')!;
    expect(credito).toMatchObject({
      ultimaVersionId: '7',
      ultimaVersion: 'v2.0.1',
      ultimaEstado: 'APPROVED',
    });
  });

  it('una aprobada sin desplegar se ofrece para desplegar, dice qué sigue activo y sale primero', () => {
    const [primera] = ultimaVersionPorAlgoritmo(VERSIONES, DESPLIEGUES);
    expect(primera).toMatchObject({
      artifactCode: 'ATLAS_BNPL_UNDERWRITING',
      desplegable: true,
      activa: 'STAGING v2.0.0',
      siguiente: 'Aprobada y sin desplegar: lista para desplegar.',
    });
  });

  it('la que ya está activa está al día y no ofrece desplegar otra vez', () => {
    const kyb = ultimaVersionPorAlgoritmo(VERSIONES, DESPLIEGUES).find(
      (f) => f.artifactCode === 'PARTNER_KYB_REVIEW',
    )!;
    expect(kyb).toMatchObject({
      desplegable: false,
      activa: 'STAGING v1.0.0',
      siguiente: 'Al día: la última versión ya está activa.',
    });
  });

  it('una en revisión dice que faltan las firmas y no se puede desplegar', () => {
    const nuevo = ultimaVersionPorAlgoritmo(VERSIONES, DESPLIEGUES).find(
      (f) => f.artifactCode === 'NUEVO',
    )!;
    expect(nuevo).toMatchObject({ desplegable: false, activa: 'Ninguna' });
    expect(nuevo.siguiente).toMatch(/firmas/);
  });

  it('un despliegue vencido o suspendido no cuenta como activo', () => {
    const filas = ultimaVersionPorAlgoritmo(
      [version('4', 'X', 1, '1.0.0', 'APPROVED')],
      [
        activo('4', 'STAGING', { isActive: false }),
        activo('4', 'STAGING', { deploymentStatus: 'SUSPENDED' }),
      ],
    );
    expect(filas[0]).toMatchObject({ activa: 'Ninguna', desplegable: true });
  });
});
