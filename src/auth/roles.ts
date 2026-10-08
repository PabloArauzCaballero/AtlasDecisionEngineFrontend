const aliases: Readonly<Record<string, readonly string[]>> = {
  SUPER_ADMIN: ['PLATFORM_ADMIN'],
  SYSTEMS_ADMIN: ['PLATFORM_ADMIN'],
  INTERNAL_IDENTITY_ADMIN: ['PLATFORM_ADMIN'],
  COMPLIANCE_ANALYST: ['COMPLIANCE'],
  QA_ENGINEER: ['QA_ANALYST'],
  READONLY_AUDITOR: ['AUDITOR'],
  OPS_MANAGER: ['OPERATIONS'],
  OPERATIONS_AGENT: ['OPERATIONS'],
  SUPPORT_AGENT: ['OPERATIONS'],
  INTERNAL_OPERATOR: ['OPERATIONS'],
  /*
   * Copia de `identity-role-mapper.ts` del backend del Motor: la sesión trae los códigos de rol
   * de Core SIN traducir, así que si esta tabla se queda atrás el menú esconde lo que el backend
   * sí permite. Así pasó hasta el 2026-10-08: «Jefatura de riesgo» no veía Revisiones, aunque
   * el backend la dejaba firmar; y Operaciones, Finanzas y Datos entraban sin ningún rol.
   */
  RISK_MANAGER: ['RISK_APPROVER'],
  COMPLIANCE_MANAGER: ['COMPLIANCE'],
  AUDITOR_READONLY: ['AUDITOR'],
  OPERATIONS_MANAGER: ['OPERATIONS'],
  OPERATIONS_ANALYST: ['OPERATIONS'],
  MERCHANT_OPERATIONS: ['OPERATIONS'],
  FINANCE_MANAGER: ['AUDITOR'],
  EXECUTIVE_READONLY: ['AUDITOR'],
  DATA_GOVERNANCE_MANAGER: ['AUDITOR'],
  DATA_QUALITY_ANALYST: ['AUDITOR'],
};

export function decisionRoles(roles: readonly string[]): string[] {
  const result = new Set<string>();
  for (const role of roles) {
    const normalized = role.trim().toUpperCase();
    if (normalized) result.add(normalized);
    for (const alias of aliases[normalized] ?? []) result.add(alias);
  }
  return [...result];
}

export function hasAnyRole(userRoles: readonly string[], required: readonly string[]): boolean {
  if (!required.length) return true;
  const effective = decisionRoles(userRoles);
  return effective.includes('PLATFORM_ADMIN') || required.some((role) => effective.includes(role));
}
