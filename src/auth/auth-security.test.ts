import { decisionRoles, hasAnyRole } from './roles';
import { tokenExpirationMs } from './token';

function token(payload: object): string {
  const encoded = btoa(JSON.stringify(payload))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `header.${encoded}.signature`;
}

describe('frontend authentication helpers', () => {
  it('reads token expiration without trusting other JWT claims', () => {
    expect(tokenExpirationMs(token({ exp: 1_800_000_000, roles: ['PLATFORM_ADMIN'] }))).toBe(
      1_800_000_000_000,
    );
    expect(tokenExpirationMs('not-a-jwt')).toBeNull();
  });

  it('maps provider roles and honors platform administrator access', () => {
    expect(decisionRoles(['qa_engineer'])).toEqual(['QA_ENGINEER', 'QA_ANALYST']);
    expect(hasAnyRole(['SUPER_ADMIN'], ['COMPLIANCE'])).toBe(true);
    expect(hasAnyRole(['READONLY_AUDITOR'], ['RISK_APPROVER'])).toBe(false);
  });
});
