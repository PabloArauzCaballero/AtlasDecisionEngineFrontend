export interface PolicyDraft {
  policyCode: string;
  rationale: string;
  owner: string;
  severity: string;
}

interface ObjectiveDraft {
  objectiveCode: string;
  name: string;
  metric: string;
  target: string;
  targetUnit: string;
  ownerTeam: string;
  policies: PolicyDraft[];
}

export function buildObjectivePayload(draft: ObjectiveDraft) {
  return {
    objectiveCode: draft.objectiveCode,
    name: draft.name.trim(),
    metric: draft.metric.trim(),
    target: {
      current: 'Pendiente',
      target: draft.target.trim(),
      ...(draft.targetUnit.trim() ? { unit: draft.targetUnit.trim() } : {}),
      currentPct: 0,
      targetPct: 100,
    },
    ownerTeam: draft.ownerTeam.trim(),
    policies: draft.policies.map((policy) => ({
      ...policy,
      policyCode: policy.policyCode.trim(),
      rationale: policy.rationale.trim(),
      owner: policy.owner.trim(),
    })),
  };
}

export function createPolicyDraft(ownerTeam: string): PolicyDraft {
  return {
    policyCode: '',
    rationale: '',
    owner: ownerTeam.trim(),
    severity: 'WARNING',
  };
}

export function normalizeObjectiveCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9_-]/g, '');
}
