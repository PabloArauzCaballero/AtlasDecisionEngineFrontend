import { buildObjectivePayload, normalizeObjectiveCode } from './objective-authoring';

describe('objective authoring', () => {
  it('normalizes codes to the backend contract', () => {
    expect(normalizeObjectiveCode('fraude digital 2026!')).toBe('FRAUDEDIGITAL2026');
  });

  it('builds a trimmed objective payload with optional policies', () => {
    const payload = buildObjectivePayload({
      objectiveCode: 'FRAUD_2026',
      name: ' Reducir fraude ',
      metric: ' Tasa de fraude ',
      target: ' < 0.8 ',
      targetUnit: ' % ',
      ownerTeam: ' Riesgo ',
      policies: [],
    });

    expect(payload).toEqual(
      expect.objectContaining({
        name: 'Reducir fraude',
        ownerTeam: 'Riesgo',
        target: expect.objectContaining({ target: '< 0.8', unit: '%' }),
        policies: [],
      }),
    );
  });
});
