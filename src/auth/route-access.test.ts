import { canAccessPath, requiredRolesForPath } from './route-access';

describe('route access policies', () => {
  it('allows every authenticated role to open platform health', () => {
    expect(requiredRolesForPath('/platform-health')).toEqual([]);
    expect(canAccessPath('/platform-health', [])).toBe(true);
  });

  it('applies authoring roles to graph routes', () => {
    expect(canAccessPath('/artifact-versions/version-1/graph', ['RISK_ANALYST'])).toBe(true);
    expect(canAccessPath('/artifact-versions/version-1/graph', ['QA_ANALYST'])).toBe(false);
  });

  it('applies quality roles to dynamic test routes', () => {
    expect(canAccessPath('/test-suites/suite-1/cases', ['QA_ENGINEER'])).toBe(true);
    expect(canAccessPath('/test-runs/run-1', ['FRAUD_ANALYST'])).toBe(true);
  });

  it('allows platform administrators through normalized aliases', () => {
    expect(canAccessPath('/coverage-matrix', ['SUPER_ADMIN'])).toBe(true);
    expect(canAccessPath('/manual-reviews/case-1', ['SYSTEMS_ADMIN'])).toBe(true);
  });

  it('denies unknown routes by default', () => {
    expect(requiredRolesForPath('/unregistered-operation')).toBeNull();
    expect(canAccessPath('/unregistered-operation', ['PLATFORM_ADMIN'])).toBe(false);
  });

  it('applies nested-tree roles to the dependency graph route without matching the broader artifacts route', () => {
    expect(canAccessPath('/artifacts/artifact-1/dependency-graph', ['AUDITOR'])).toBe(true);
    expect(canAccessPath('/artifacts/artifact-1/dependency-graph', ['OPERATIONS'])).toBe(false);
    // A plain artifact detail path must still resolve through the broader artifacts policy.
    expect(canAccessPath('/artifacts/artifact-1', ['AUDITOR'])).toBe(true);
  });

  it('restricts the code-to-flow import route to authoring roles, denying read-only roles', () => {
    expect(canAccessPath('/code-import', ['RISK_ANALYST'])).toBe(true);
    expect(canAccessPath('/code-import', ['AUDITOR'])).toBe(false);
  });

  it('grants the security review dashboard to security-team roles, denying a plain risk analyst', () => {
    expect(canAccessPath('/security-review/version-1', ['COMPLIANCE'])).toBe(true);
    expect(canAccessPath('/security-review/version-1', ['AUDITOR'])).toBe(true);
    expect(canAccessPath('/security-review/version-1', ['RISK_ANALYST'])).toBe(false);
  });
});
