import { isInternalPath, safeInternalPath } from './internal-path';

describe('isInternalPath', () => {
  it.each(['/platform-health', '/approval-requests/31?tab=gates#firma', '/', '/buscar?q=%0a'])(
    'acepta la ruta interna %j',
    (value) => expect(isInternalPath(value)).toBe(true),
  );

  it.each([
    '//evil.com',
    '/\\evil.com',
    '/\\/evil.com',
    '/a\\b',
    '/\t/evil.com',
    '/\n/evil.com',
    'https://evil.com',
    'javascript:alert(1)',
    'evil.com',
    '',
    null,
    undefined,
  ])('rechaza %j', (value) => expect(isInternalPath(value)).toBe(false));
});

describe('safeInternalPath', () => {
  it('devuelve el respaldo ante un destino externo', () => {
    expect(safeInternalPath('/\\evil.com', '/platform-health')).toBe('/platform-health');
    expect(safeInternalPath('/workers', '/platform-health')).toBe('/workers');
  });
});
