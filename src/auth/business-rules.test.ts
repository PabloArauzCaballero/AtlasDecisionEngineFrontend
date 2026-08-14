import {
  canConsultCaseFile,
  canCreateArtifact,
  canPromoteToEnvironment,
  canProposeArtifactChange,
  canRequestCaseInformation,
  isProductionEnvironment,
  OBJECTIVE_AUTHORING_ROLES,
  promotionDenialReason,
} from './business-rules';
import { hasAnyRole } from './roles';

const DEV = { code: 'DEV', isProduction: false };
const PROD = { code: 'PROD', isProduction: true };

describe('alta de artefactos', () => {
  it('sólo la concede a un administrador de plataforma, incluidos sus alias', () => {
    expect(canCreateArtifact(['PLATFORM_ADMIN'])).toBe(true);
    expect(canCreateArtifact(['SUPER_ADMIN'])).toBe(true);
  });

  it('la niega a quien propone cambios y a quien sólo consulta', () => {
    expect(canCreateArtifact(['QA_ANALYST'])).toBe(false);
    expect(canCreateArtifact(['FRAUD_ANALYST'])).toBe(false);
    expect(canCreateArtifact(['RISK_ANALYST'])).toBe(false);
    expect(canCreateArtifact([])).toBe(false);
  });
});

describe('propuesta de cambio sobre un artefacto', () => {
  it('la concede al tester, al analista de fraude y al administrador', () => {
    expect(canProposeArtifactChange(['QA_ANALYST'])).toBe(true);
    expect(canProposeArtifactChange(['QA_ENGINEER'])).toBe(true);
    expect(canProposeArtifactChange(['FRAUD_ANALYST'])).toBe(true);
    expect(canProposeArtifactChange(['PLATFORM_ADMIN'])).toBe(true);
  });

  it('la niega al analista de riesgo: no programa reglas de decisión', () => {
    expect(canProposeArtifactChange(['RISK_ANALYST'])).toBe(false);
    expect(canProposeArtifactChange(['RISK_APPROVER'])).toBe(false);
    expect(canProposeArtifactChange(['AUDITOR'])).toBe(false);
    expect(canProposeArtifactChange(['COMPLIANCE'])).toBe(false);
  });
});

describe('qué ambiente cuenta como producción', () => {
  it('hace caso a la bandera del backend antes que al código', () => {
    expect(isProductionEnvironment({ code: 'PROD', isProduction: false })).toBe(false);
    expect(isProductionEnvironment({ code: 'STAGING', isProduction: true })).toBe(true);
  });

  it('reconoce el código cuando no hay bandera, porque el selector degrada a texto libre', () => {
    expect(isProductionEnvironment({ code: 'prod' })).toBe(true);
    expect(isProductionEnvironment({ code: 'PRODUCTION' })).toBe(true);
    expect(isProductionEnvironment({ code: 'TEST' })).toBe(false);
  });

  it('asume producción cuando no sabe nada: fallar hacia el lado seguro', () => {
    expect(isProductionEnvironment(null)).toBe(true);
    expect(isProductionEnvironment(undefined)).toBe(true);
    expect(isProductionEnvironment({ code: '   ' })).toBe(true);
  });
});

describe('promoción de una versión («merge»)', () => {
  it('deja al tester promover a un ambiente de trabajo', () => {
    expect(canPromoteToEnvironment(['QA_ANALYST'], DEV)).toBe(true);
    expect(canPromoteToEnvironment(['FRAUD_ANALYST'], { code: 'TEST', isProduction: false })).toBe(
      true,
    );
  });

  it('reserva producción al administrador', () => {
    expect(canPromoteToEnvironment(['QA_ANALYST'], PROD)).toBe(false);
    expect(canPromoteToEnvironment(['FRAUD_ANALYST'], PROD)).toBe(false);
    expect(canPromoteToEnvironment(['PLATFORM_ADMIN'], PROD)).toBe(true);
  });

  it('no deja promover a nada al analista de riesgo', () => {
    expect(canPromoteToEnvironment(['RISK_ANALYST'], DEV)).toBe(false);
    expect(canPromoteToEnvironment(['RISK_ANALYST'], PROD)).toBe(false);
  });

  it('explica el motivo del bloqueo, distinguiendo producción del resto', () => {
    expect(promotionDenialReason(['PLATFORM_ADMIN'], PROD)).toBeNull();
    expect(promotionDenialReason(['QA_ANALYST'], DEV)).toBeNull();
    expect(promotionDenialReason(['QA_ANALYST'], PROD)).toMatch(/Platform Admin/);
    expect(promotionDenialReason(['RISK_ANALYST'], DEV)).toMatch(/QA Analyst/);
  });
});

describe('expediente del caso', () => {
  it('lo abre quien opera casos, no quien sólo audita', () => {
    expect(canConsultCaseFile(['RISK_ANALYST'])).toBe(true);
    expect(canConsultCaseFile(['FRAUD_ANALYST'])).toBe(true);
    expect(canConsultCaseFile(['OPERATIONS'])).toBe(true);
    expect(canConsultCaseFile(['AUDITOR'])).toBe(false);
  });

  it('deja al analista de riesgo pedir más información aunque no toque ninguna regla', () => {
    expect(canRequestCaseInformation(['RISK_ANALYST'])).toBe(true);
    expect(canRequestCaseInformation(['QA_ANALYST'])).toBe(false);
  });
});

describe('objetivos de negocio', () => {
  /*
   * La distinción que se pierde con facilidad: decidir UN caso concreto sigue
   * siendo del analista de riesgo —es su trabajo diario—, pero fijar el objetivo
   * con el que se juzga a un algoritmo es gobierno. Sacarle lo primero al
   * confundirlo con lo segundo dejaría la cola de revisión manual sin dueño.
   */
  it('los fija Compliance, no el analista de riesgo', () => {
    expect(hasAnyRole(['COMPLIANCE'], OBJECTIVE_AUTHORING_ROLES)).toBe(true);
    expect(hasAnyRole(['PLATFORM_ADMIN'], OBJECTIVE_AUTHORING_ROLES)).toBe(true);
    expect(hasAnyRole(['RISK_ANALYST'], OBJECTIVE_AUTHORING_ROLES)).toBe(false);
    expect(hasAnyRole(['QA_ANALYST'], OBJECTIVE_AUTHORING_ROLES)).toBe(false);
  });

  it('no le quita al analista de riesgo la resolución de casos, que sí es suya', () => {
    expect(canConsultCaseFile(['RISK_ANALYST'])).toBe(true);
  });
});
