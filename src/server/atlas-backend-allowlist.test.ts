import { atlasBackendAccess } from './atlas-backend-allowlist';

const split = (path: string) => path.split('/');

describe('atlasBackendAccess', () => {
  /*
   * Las rutas que el portal llama hoy. Si una pantalla deja de funcionar por la lista blanca,
   * esta tabla es la que tiene que crecer —con su método—, no el proxy volver a ser un comodín.
   */
  it.each([
    ['GET', 'data-notebook/datasets'],
    ['GET', 'data-notebook/datasets/clientes/rows'],
    ['GET', 'data-notebook/history'],
    ['POST', 'data-notebook/history'],
    ['POST', 'data-notebook/notebooks'],
    ['PUT', 'data-notebook/notebooks/12'],
    ['PATCH', 'data-notebook/notebooks/12'],
    ['DELETE', 'data-notebook/notebooks/12'],
    ['GET', 'sql-console/catalog'],
    ['POST', 'sql-console/validate'],
    ['POST', 'sql-console/query'],
    ['POST', 'internal/assist/chat'],
    ['GET', 'internal/assist/conversation'],
    ['GET', 'internal/assist/conversations'],
    ['GET', 'internal/assist/conversations/9'],
    ['DELETE', 'internal/assist/conversations/9'],
    ['GET', 'expedientes/por-momento'],
    ['GET', 'expedientes/por-sujeto/customer/53'],
    ['GET', 'expedientes/4/nodos'],
    ['GET', 'expedientes/4/nodos/7/contenido'],
    ['HEAD', 'expedientes/4/nodos/7/contenido'],
    ['GET', 'customer-onboarding/identity-verifications/88/evidence-documents'],
    ['GET', 'customer-onboarding/53/evidence-documents/abc/content'],
  ])('%s %s está abierta', (method, path) => {
    expect(atlasBackendAccess(method, split(path))).toBe('allowed');
  });

  it.each([
    'internal/auth/me',
    'internal/admin/users',
    'customers/53',
    'customer-onboarding/53/submit',
    'customer-onboarding/53/evidence-documents',
    'customer-onboarding/identity-verifications/88/approve',
    'data-notebook',
    'internal/assist',
    'internal',
    'health',
    'DATA-NOTEBOOK/datasets',
  ])('%s responde 404', (path) => {
    expect(atlasBackendAccess('GET', split(path))).toBe('not-found');
  });

  it('un método que la pantalla no usa es 405, no un paso libre', () => {
    expect(atlasBackendAccess('DELETE', split('expedientes/4/nodos'))).toBe('method-not-allowed');
    expect(
      atlasBackendAccess('POST', split('customer-onboarding/53/evidence-documents/a/content')),
    ).toBe('method-not-allowed');
    expect(atlasBackendAccess('PUT', split('sql-console/query'))).toBe('method-not-allowed');
    expect(atlasBackendAccess('OPTIONS', split('sql-console/query'))).toBe('method-not-allowed');
  });
});
