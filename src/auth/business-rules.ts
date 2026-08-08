import { hasAnyRole } from './roles';

/**
 * Reglas de negocio del ciclo de vida de un artefacto, en un solo lugar.
 *
 * El vocabulario del encargo se traduce al catálogo de roles que el IdP emite de
 * verdad (`docs/usuarios-roles-y-permisos.md`); no se inventan roles nuevos,
 * porque un rol que nadie emite deja la regla apagada sin avisar:
 *
 * | Encargo             | Rol real                       |
 * | ------------------- | ------------------------------ |
 * | admin               | `PLATFORM_ADMIN`               |
 * | tester              | `QA_ANALYST`                   |
 * | analista de riesgo  | `RISK_ANALYST`                 |
 *
 * Y el vocabulario de ramas se traduce a lo que el backend sí modela —no hay
 * merge ni ramas: hay versiones inmutables y despliegues por ambiente
 * (`docs/auditoria-versionado-2026-08-03.md` §1)—:
 *
 * - «mergear a dev»  → promover a un ambiente NO productivo (`SANDBOX`, `TEST`).
 * - «mergear a main» → promover a un ambiente productivo (`isProduction`).
 *
 * Nada de esto es un control de acceso: el backend revalida cada POST con sus
 * propios `@Roles`. Lo que sí evita es ofrecer una acción que va a terminar en
 * 403 sin explicar por qué.
 */

/** Dar de alta un artefacto nuevo. Sólo la administración de la plataforma. */
export const ARTIFACT_CREATE_ROLES = ['PLATFORM_ADMIN'] as const;

/**
 * Proponer un cambio: crear una versión sobre un artefacto existente, probarla
 * y enviarla a revisión. Es el equivalente al «pull request» del encargo.
 *
 * `RISK_ANALYST` NO está: el analista de riesgo no programa, y una regla de
 * decisión es exactamente lo que no debe poder tocar.
 */
export const CHANGE_PROPOSAL_ROLES = ['QA_ANALYST', 'FRAUD_ANALYST'] as const;

/** Promover a producción («main»). */
export const PRODUCTION_PROMOTION_ROLES = ['PLATFORM_ADMIN'] as const;

/** Consultar el expediente completo de un caso y pedir más información. */
export const CASE_CONSULT_ROLES = ['RISK_ANALYST', 'FRAUD_ANALYST', 'OPERATIONS'] as const;

/**
 * Definir objetivos de negocio y su matriz de cobertura.
 *
 * `RISK_ANALYST` no está: un objetivo es el criterio con el que se juzga si un
 * algoritmo cumple, y fijarlo es gobernar, no consultar. Resolver un caso de
 * revisión manual SÍ sigue siendo suyo —ver `CASE_CONSULT_ROLES`—: eso es
 * decidir sobre un expediente concreto, no fijar la vara con que se mide.
 */
export const OBJECTIVE_AUTHORING_ROLES = ['COMPLIANCE'] as const;

/** Ambiente tal como lo devuelve `/v1/environments`, con lo mínimo que hace falta. */
export interface PromotionTarget {
  code: string;
  isProduction?: boolean | null;
}

export function canCreateArtifact(roles: readonly string[]): boolean {
  return hasAnyRole(roles, ARTIFACT_CREATE_ROLES);
}

/** Crear una versión, editarla, compilarla y enviarla a revisión. */
export function canProposeArtifactChange(roles: readonly string[]): boolean {
  return hasAnyRole(roles, CHANGE_PROPOSAL_ROLES);
}

/**
 * Un ambiente es «main» si el backend lo marca como productivo.
 *
 * El código `PROD` se acepta como respaldo porque el selector degrada a texto
 * libre cuando el catálogo no carga, y ahí no hay bandera que leer. Y si no se
 * sabe nada del ambiente, se asume productivo: fallar hacia el lado seguro es
 * pedir un administrador de más, no dejar pasar un despliegue a clientes.
 */
export function isProductionEnvironment(target: PromotionTarget | null | undefined): boolean {
  if (!target) return true;
  if (typeof target.isProduction === 'boolean') return target.isProduction;
  const code = target.code.trim().toUpperCase();
  if (!code) return true;
  return code === 'PROD' || code === 'PRODUCTION';
}

/**
 * Promover una versión a un ambiente.
 *
 * A un ambiente de trabajo lo promueve quien propone el cambio; a producción,
 * sólo un administrador.
 */
export function canPromoteToEnvironment(
  roles: readonly string[],
  target: PromotionTarget | null | undefined,
): boolean {
  return isProductionEnvironment(target)
    ? hasAnyRole(roles, PRODUCTION_PROMOTION_ROLES)
    : canProposeArtifactChange(roles);
}

/** Por qué no se puede promover, para decirlo en pantalla. `null` si sí se puede. */
export function promotionDenialReason(
  roles: readonly string[],
  target: PromotionTarget | null | undefined,
): string | null {
  if (canPromoteToEnvironment(roles, target)) return null;
  return isProductionEnvironment(target)
    ? 'Promover a producción requiere rol Platform Admin.'
    : 'Promover una versión requiere rol QA Analyst o Fraud Analyst.';
}

/** Ver el expediente completo del caso: datos del cliente, ejecución y decisión. */
export function canConsultCaseFile(roles: readonly string[]): boolean {
  return hasAnyRole(roles, CASE_CONSULT_ROLES);
}

/**
 * Pedir información adicional sobre un caso, incluida la que sólo tiene el
 * backend central. Es la única escritura que el analista de riesgo conserva
 * sobre un artefacto: no cambia ninguna regla, pide datos.
 */
export function canRequestCaseInformation(roles: readonly string[]): boolean {
  return hasAnyRole(roles, CASE_CONSULT_ROLES);
}
