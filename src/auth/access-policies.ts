export const accessPolicies = {
  platformHealth: [] as const,
  // Search spans every domain; each hit still gates at its target route.
  globalSearch: [] as const,
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
} as const;
