/**
 * Regla de negocio: el analista de riesgo NO edita reglas de decisión.
 *
 * `RISK_ANALYST` es un rol de consulta y de operación sobre casos: lee el
 * catálogo, los artefactos, las ejecuciones y la auditoría, y resuelve la cola
 * de revisión manual. No aparece en ninguna política de AUTORÍA —grafo,
 * acciones, importación de código, suites, QA Lab, simulador— porque no
 * programa, y una regla de decisión es exactamente lo que no debe poder tocar.
 *
 * Quien propone cambios es el tester (`QA_ANALYST`) y el analista de fraude
 * (`FRAUD_ANALYST`); quien da de alta artefactos y publica en producción es
 * `PLATFORM_ADMIN`. Ver `business-rules.ts`, que es donde vive esa parte.
 */
export const accessPolicies = {
  platformHealth: [] as const,
  // Search spans every domain; each hit still gates at its target route.
  globalSearch: [] as const,
  // El Centro de Tutoriales es abierto como la búsqueda: la lista se recorta por
  // rol dentro de la vista, y cada recorrido hereda el permiso de su pantalla.
  tutorials: [] as const,
  // Leer el catálogo es amplio; el alta se estrecha en `resource.config.ts` con
  // `createRoles`, porque declarar una variable es autoría y consultarla no.
  catalogRead: ['RISK_ANALYST', 'QA_ANALYST', 'FRAUD_ANALYST', 'COMPLIANCE', 'AUDITOR'] as const,
  artifacts: ['RISK_ANALYST', 'FRAUD_ANALYST', 'QA_ANALYST', 'AUDITOR'] as const,
  graphAuthoring: ['QA_ANALYST', 'FRAUD_ANALYST'] as const,
  artifactCompile: ['QA_ANALYST', 'FRAUD_ANALYST'] as const,
  qualityAuthoring: ['QA_ANALYST', 'FRAUD_ANALYST'] as const,
  coverageRead: ['QA_ANALYST', 'RISK_ANALYST', 'AUDITOR'] as const,
  // `FRAUD_ANALYST` entra como solicitante: quien propone un cambio necesita
  // enviarlo a revisión y seguir su solicitud. Firmar cada paso lo sigue
  // decidiendo el `requiredRole` que el backend declara (`decision-policy.ts`).
  governanceReview: [
    'QA_ANALYST',
    'FRAUD_ANALYST',
    'RISK_APPROVER',
    'COMPLIANCE',
    'AUDITOR',
  ] as const,
  environments: [
    'PLATFORM_ADMIN',
    'RISK_ANALYST',
    'QA_ANALYST',
    'FRAUD_ANALYST',
    'AUDITOR',
  ] as const,
  // Simular ejecuta el motor con entradas inventadas: es una herramienta de
  // autoría, no de consulta. El analista de riesgo ve las ejecuciones reales.
  simulator: ['QA_ANALYST', 'FRAUD_ANALYST'] as const,
  manualReview: ['OPERATIONS', 'RISK_ANALYST', 'FRAUD_ANALYST'] as const,
  executionAudit: ['AUDITOR', 'COMPLIANCE', 'RISK_ANALYST', 'OPERATIONS'] as const,
  auditEvents: ['AUDITOR', 'COMPLIANCE', 'RISK_ANALYST'] as const,
  // Monitoreo continuo del modelo desplegado. Espeja los roles que el motor exige en
  // `/v1/model-monitoring` para los tres análisis de LECTURA (desempeño, estabilidad e impacto
  // adverso). No incluye `OPERATIONS`: ése es el rol que CARGA desenlaces, y quien alimenta la
  // medida no tiene por qué ser quien la lee — la separación es lo que hace lícito el autoexamen.
  modelMonitoring: ['RISK_ANALYST', 'COMPLIANCE', 'AUDITOR', 'RISK_APPROVER'] as const,
  // Calidad del circuito: cobertura de sujeto, cola de desenlaces por observar y cosechas.
  // Aquí SÍ entra `OPERATIONS`, al revés que en `modelMonitoring`, y por el mismo argumento:
  // esta pantalla es donde se CARGAN los desenlaces y se dan de alta los créditos, que es
  // precisamente su trabajo. La separación se mantiene —quien alimenta la medida sigue sin
  // poder leer los tres análisis de degradación— pero medir si el sistema de medición está
  // vivo tiene que poder verlo quien lo alimenta, o nadie se entera de que se paró.
  decisionQuality: [
    'OPERATIONS',
    'RISK_ANALYST',
    'COMPLIANCE',
    'AUDITOR',
    'RISK_APPROVER',
  ] as const,
  // Derechos del titular (LGPD art. 18 y 20). Espeja exactamente los roles que el motor exige
  // en `/v1/data-subject-requests`: consultar todas las decisiones tomadas sobre una persona es
  // una capacidad distinta de diseñar el artefacto que las toma, y por eso no hay autoría aquí.
  dataSubjectRights: ['COMPLIANCE', 'OPERATIONS', 'AUDITOR'] as const,
  // Gobierno del riesgo: apetito de cartera, calibración, licitud vigente, reidentificación y
  // expediente. La vista es de LECTURA amplia y cada escritura la acota el motor por su cuenta
  // —un límite de cartera sólo lo mueve `RISK_APPROVER`, un permiso sólo `COMPLIANCE`—. Cerrar
  // también la lectura dejaría a quien opera sin poder explicar por qué se rechazó una solicitud
  // buena un 28 de mes, que es justo la pregunta que esta pantalla existe para contestar.
  riskGovernance: ['RISK_ANALYST', 'RISK_APPROVER', 'COMPLIANCE', 'AUDITOR', 'OPERATIONS'] as const,
  traceability: ['RISK_ANALYST', 'QA_ANALYST', 'COMPLIANCE', 'AUDITOR'] as const,
  // Fase 7 — nested decision trees. Mirrors the backend's read roles for
  // GET /v1/artifacts/{id}/dependency-graph (see docs/nested-decision-trees.md).
  nestedTrees: ['RISK_ANALYST', 'FRAUD_ANALYST', 'QA_ANALYST', 'COMPLIANCE', 'AUDITOR'] as const,
  // Fase 5 — code-to-flow import. Write actions mirror graphAuthoring on the backend.
  codeImport: ['QA_ANALYST', 'FRAUD_ANALYST'] as const,
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
  qaLab: ['QA_ANALYST', 'FRAUD_ANALYST'] as const,
  // ADR-0031 — consola de consultas SQL gobernada.
  //
  // Espeja EXACTAMENTE los cinco roles que el motor exige en `/v1/sql-console`. Que sea la
  // misma lista importa más aquí que en otras pantallas: la consola no tiene botones que
  // ocultar —es un cuadro de texto— así que un permiso de más no se notaría como un control
  // apagado, sino como un 403 al ejecutar, después de haber escrito la consulta entera.
  //
  // `OPERATIONS` y `QA_ANALYST` quedan fuera a propósito, y el motivo está escrito en el
  // controlador del motor: quien CARGA desenlaces no es quien los interpreta, y quien diseña
  // artefactos trabaja contra datos sintéticos, mientras que los cinco datasets de la consola
  // contienen decisiones sobre personas reales.
  sqlConsole: ['RISK_ANALYST', 'FRAUD_ANALYST', 'RISK_APPROVER', 'COMPLIANCE', 'AUDITOR'] as const,
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
