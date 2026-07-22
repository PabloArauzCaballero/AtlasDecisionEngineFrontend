import { accessPolicies } from './access-policies';
import { hasAnyRole } from './roles';

interface RouteAccessRule {
  pattern: RegExp;
  roles: readonly string[];
}

const routeAccessRules: readonly RouteAccessRule[] = [
  { pattern: /^\/platform-health\/?$/, roles: accessPolicies.platformHealth },
  { pattern: /^\/search\/?$/, roles: accessPolicies.globalSearch },
  { pattern: /^\/variables\/?$/, roles: accessPolicies.catalogRead },
  { pattern: /^\/reason-codes\/?$/, roles: accessPolicies.catalogRead },
  { pattern: /^\/artifacts(?:\/[^/]+)?\/?$/, roles: accessPolicies.artifacts },
  { pattern: /^\/graph-editor\/?$/, roles: accessPolicies.graphAuthoring },
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
  {
    pattern: /^\/manual-reviews(?:\/[^/]+)?\/?$/,
    roles: accessPolicies.manualReview,
  },
  {
    pattern: /^\/executions(?:\/[^/]+)?\/?$/,
    roles: accessPolicies.executionAudit,
  },
  { pattern: /^\/audit-events\/?$/, roles: accessPolicies.auditEvents },
  {
    pattern: /^\/objectives(?:\/[^/]+)?\/?$/,
    roles: accessPolicies.traceability,
  },
  { pattern: /^\/coverage-matrix\/?$/, roles: accessPolicies.traceability },
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
