export const accessPolicies = {
  platformHealth: [] as const,
  // Search spans every domain; each hit still gates at its target route.
  globalSearch: [] as const,
  // El Centro de Tutoriales es abierto como la búsqueda: la lista se recorta por
  // rol dentro de la vista, y cada recorrido hereda el permiso de su pantalla.
  tutorials: [] as const,
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
  // §5 — campos calculados reutilizables. Leerlos es catálogo; crear versiones exige el
  // mismo rol que diseñar un grafo, porque su código entra en decisiones reales.
  calculatedFields: [
    'RISK_ANALYST',
    'FRAUD_ANALYST',
    'QA_ANALYST',
    'COMPLIANCE',
    'AUDITOR',
  ] as const,
  // §7 — registro de librerías autorizadas: lectura amplia, alta solo desde el backend.
  libraryRegistry: [
    'RISK_ANALYST',
    'FRAUD_ANALYST',
    'QA_ANALYST',
    'COMPLIANCE',
    'AUDITOR',
    'PLATFORM_ADMIN',
  ] as const,
  // §10 — QA Lab. Mismos roles que la autoría de calidad: una corrida ejecuta el motor.
  qaLab: ['QA_ANALYST', 'RISK_ANALYST', 'FRAUD_ANALYST'] as const,
  // ADR-0026 — workers adicionales (análisis semántico y extractos bancarios).
  //
  // Es el permiso de VER la pestaña, y por eso es amplio: incluye a quien
  // audita o cumple normativa, que necesita leer una ejecución sin poder
  // lanzarla. Ejecutar y cargar archivos exigen más, y eso lo valida el backend
  // con sus propios `@Roles` — ocultar un botón no es un control de acceso.
  workers: [
    'RISK_ANALYST',
    'FRAUD_ANALYST',
    'QA_ANALYST',
    'OPERATIONS',
    'COMPLIANCE',
    'AUDITOR',
  ] as const,
} as const;
