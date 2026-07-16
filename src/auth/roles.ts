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
