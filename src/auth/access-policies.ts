export const accessPolicies = {
  platformHealth: [] as const,
  catalogRead: ['RISK_ANALYST', 'QA_ANALYST', 'COMPLIANCE', 'AUDITOR'] as const,
  artifacts: ['RISK_ANALYST', 'FRAUD_ANALYST', 'QA_ANALYST', 'AUDITOR'] as const,
  graphAuthoring: ['RISK_ANALYST', 'FRAUD_ANALYST'] as const,
  artifactCompile: ['RISK_ANALYST', 'FRAUD_ANALYST', 'QA_ANALYST'] as const,
  qualityAuthoring: ['QA_ANALYST', 'RISK_ANALYST', 'FRAUD_ANALYST'] as const,
  coverageRead: ['QA_ANALYST', 'RISK_ANALYST', 'AUDITOR'] as const,
  governanceReview: ['QA_ANALYST', 'RISK_APPROVER', 'COMPLIANCE', 'AUDITOR'] as const,
  environments: ['PLATFORM_ADMIN', 'RISK_ANALYST', 'QA_ANALYST', 'AUDITOR'] as const,
  simulator: ['RISK_ANALYST', 'FRAUD_ANALYST', 'QA_ANALYST'] as const,
  manualReview: ['OPERATIONS', 'RISK_ANALYST', 'FRAUD_ANALYST'] as const,
  executionAudit: ['AUDITOR', 'COMPLIANCE', 'RISK_ANALYST', 'OPERATIONS'] as const,
  auditEvents: ['AUDITOR', 'COMPLIANCE', 'RISK_ANALYST'] as const,
  traceability: ['RISK_ANALYST', 'QA_ANALYST', 'COMPLIANCE', 'AUDITOR'] as const,
  // Fase 7 — nested decision trees. Mirrors the backend's read roles for
  // GET /v1/artifacts/{id}/dependency-graph (see docs/nested-decision-trees.md).
  nestedTrees: ['RISK_ANALYST', 'FRAUD_ANALYST', 'QA_ANALYST', 'COMPLIANCE', 'AUDITOR'] as const,
  // Fase 5 — code-to-flow import. Write actions mirror graphAuthoring on the backend.
  codeImport: ['RISK_ANALYST', 'FRAUD_ANALYST'] as const,
  // Fase 10 — security team dashboard. Mirrors the backend's SECURITY_TEAM_ROLES.
  securityReview: ['COMPLIANCE', 'FRAUD_ANALYST', 'RISK_APPROVER', 'AUDITOR'] as const,
} as const;
