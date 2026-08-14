import { accessPolicies } from './access-policies';
import { hasAnyRole } from './roles';

interface RouteAccessRule {
  pattern: RegExp;
  roles: readonly string[];
}

const routeAccessRules: readonly RouteAccessRule[] = [
  { pattern: /^\/platform-health\/?$/, roles: accessPolicies.platformHealth },
  // Aprender a usar el portal no puede depender del rol: cada tutorial se filtra
  // luego por el permiso de la pantalla que enseña (ver tutorial-registry.ts).
  { pattern: /^\/tutorials\/?$/, roles: accessPolicies.tutorials },
  { pattern: /^\/search\/?$/, roles: accessPolicies.globalSearch },
  { pattern: /^\/variables(?:\/[^/]+)?\/?$/, roles: accessPolicies.catalogRead },
  { pattern: /^\/reason-codes\/?$/, roles: accessPolicies.catalogRead },
  { pattern: /^\/artifacts(?:\/[^/]+)?\/?$/, roles: accessPolicies.artifacts },
  { pattern: /^\/algorithms\/?$/, roles: accessPolicies.artifacts },
  {
    pattern: /^\/artifacts\/[^/]+\/dependency-graph\/?$/,
    roles: accessPolicies.nestedTrees,
  },
  { pattern: /^\/graph-editor\/?$/, roles: accessPolicies.graphAuthoring },
  // Editar acciones cambia lo que el algoritmo hace, así que pide el mismo rol
  // que diseñar el grafo, no el de solo lectura del catálogo.
  { pattern: /^\/actions\/?$/, roles: accessPolicies.graphAuthoring },
  { pattern: /^\/code-import\/?$/, roles: accessPolicies.codeImport },
  {
    pattern: /^\/artifact-versions\/[^/]+\/graph\/?$/,
    roles: accessPolicies.graphAuthoring,
  },
  {
    pattern: /^\/artifact-versions\/[^/]+\/compile\/?$/,
    roles: accessPolicies.artifactCompile,
  },
  {
    pattern: /^\/artifact-versions\/[^/]+\/test-suites\/?$/,
    roles: accessPolicies.qualityAuthoring,
  },
  { pattern: /^\/test-suites\/?$/, roles: accessPolicies.qualityAuthoring },
  { pattern: /^\/qa-lab\/?$/, roles: accessPolicies.qaLab },
  {
    pattern: /^\/calculated-fields(?:\/[^/]+)?\/?$/,
    roles: accessPolicies.calculatedFields,
  },
  { pattern: /^\/libraries\/?$/, roles: accessPolicies.libraryRegistry },
  {
    pattern: /^\/test-suites\/[^/]+\/cases\/?$/,
    roles: accessPolicies.qualityAuthoring,
  },
  { pattern: /^\/test-cases\/?$/, roles: accessPolicies.qualityAuthoring },
  {
    pattern: /^\/test-runs\/[^/]+\/coverage\/?$/,
    roles: accessPolicies.coverageRead,
  },
  { pattern: /^\/test-runs\/[^/]+\/?$/, roles: accessPolicies.qualityAuthoring },
  { pattern: /^\/graph-coverage\/?$/, roles: accessPolicies.coverageRead },
  {
    pattern: /^\/approval-requests\/[^/]+\/?$/,
    roles: accessPolicies.governanceReview,
  },
  { pattern: /^\/reviews\/?$/, roles: accessPolicies.governanceReview },
  { pattern: /^\/environments\/?$/, roles: accessPolicies.environments },
  { pattern: /^\/deployments\/?$/, roles: accessPolicies.environments },
  { pattern: /^\/simulator\/?$/, roles: accessPolicies.simulator },
  { pattern: /^\/live-execution\/?$/, roles: accessPolicies.simulator },
  {
    pattern: /^\/manual-reviews(?:\/[^/]+)?\/?$/,
    roles: accessPolicies.manualReview,
  },
  {
    pattern: /^\/executions(?:\/[^/]+)?\/?$/,
    roles: accessPolicies.executionAudit,
  },
  { pattern: /^\/audit-events\/?$/, roles: accessPolicies.auditEvents },
  { pattern: /^\/model-monitoring\/?$/, roles: accessPolicies.modelMonitoring },
  { pattern: /^\/data-subject-requests\/?$/, roles: accessPolicies.dataSubjectRights },
  { pattern: /^\/decision-quality\/?$/, roles: accessPolicies.decisionQuality },
  { pattern: /^\/risk-governance\/?$/, roles: accessPolicies.riskGovernance },
  {
    pattern: /^\/objectives(?:\/[^/]+)?\/?$/,
    roles: accessPolicies.traceability,
  },
  { pattern: /^\/coverage-matrix\/?$/, roles: accessPolicies.traceability },
  {
    pattern: /^\/security-review\/[^/]+\/?$/,
    roles: accessPolicies.securityReview,
  },
  // ADR-0026 — workers adicionales. Una regla por vista y no un comodín
  // `/workers/...`: un comodín daría acceso a cualquier worker que se añada
  // después, sin que nadie lo decida. `/workers` a secas es el concentrador con
  // las pestañas, y por eso lleva su propia regla exacta.
  { pattern: /^\/workers\/?$/, roles: accessPolicies.workers },
  { pattern: /^\/workers\/semantic-analysis\/?$/, roles: accessPolicies.workers },
  { pattern: /^\/workers\/bank-statement\/?$/, roles: accessPolicies.workers },
  { pattern: /^\/workers\/identity-verification\/?$/, roles: accessPolicies.workers },
  { pattern: /^\/workers\/audio-tts\/?$/, roles: accessPolicies.workers },
  { pattern: /^\/workers\/pdf-generator\/?$/, roles: accessPolicies.workers },
];

/**
 * Returns the role policy for a registered portal route.
 *
 * A null result means the route is unknown and must be denied by default.
 */
export function requiredRolesForPath(pathname: string): readonly string[] | null {
  return routeAccessRules.find((rule) => rule.pattern.test(pathname))?.roles ?? null;
}

export function canAccessPath(pathname: string, userRoles: readonly string[]): boolean {
  const requiredRoles = requiredRolesForPath(pathname);
  return requiredRoles !== null && hasAnyRole(userRoles, requiredRoles);
}
