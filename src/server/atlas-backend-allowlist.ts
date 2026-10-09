/**
 * Qué parte de AtlasBackend abre `/atlas-backend/*`, y con qué métodos.
 *
 * Antes el proxy reenviaba CUALQUIER ruta bajo `api/v1`: todo AtlasBackend —incluidas las rutas
 * `@Public()` y las pensadas para la red interna— quedaba publicado bajo el dominio del Motor,
 * aunque AtlasBackend no estuviera expuesto. Es el mismo criterio que ya rige `/pdf/*`: el proxy
 * sólo abre lo que alguien decidió abrir, y una ruta nueva del backend no aparece aquí sola.
 *
 * Cada entrada sale de una llamada real del portal (buscar `/atlas-backend/` en `src/`):
 *
 * - `data-notebook/…`: el cuaderno de datos (`features/data-notebook/notebook*.api.ts`).
 * - `sql-console/…`: la consola SQL (`features/sql-console/sql-console-sources.ts`).
 * - `internal/assist/…`: el asistente y su historial (`features/assist/*.api.ts`).
 * - `expedientes/…`: el expediente de un caso de revisión (`features/manual-review/*`).
 * - `customer-onboarding/…/evidence-documents…`: las fotos y documentos de identidad del caso
 *   (`features/manual-review/CaseImagesPanel.tsx`). Sólo esa rama: el resto del alta no.
 *
 * Si una pantalla nueva necesita otra ruta, se añade aquí con su método y su prueba.
 */

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface AllowedRoute {
  /** Decide sobre los segmentos ya validados (sin `..`, sin barras). */
  matches: (segments: readonly string[]) => boolean;
  methods: readonly Method[];
}

function startsWith(...prefix: string[]) {
  return (segments: readonly string[]) =>
    segments.length > prefix.length && prefix.every((part, index) => segments[index] === part);
}

const ALLOWED: readonly AllowedRoute[] = [
  {
    matches: startsWith('data-notebook'),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  },
  { matches: startsWith('sql-console'), methods: ['GET', 'POST'] },
  { matches: startsWith('internal', 'assist'), methods: ['GET', 'POST', 'DELETE'] },
  { matches: startsWith('expedientes'), methods: ['GET'] },
  {
    // customer-onboarding/identity-verifications/:id/evidence-documents
    // customer-onboarding/:customerId/evidence-documents/:documentId/content
    matches: (segments) =>
      segments[0] === 'customer-onboarding' &&
      ((segments.length === 4 &&
        segments[1] === 'identity-verifications' &&
        segments[3] === 'evidence-documents') ||
        (segments.length === 5 &&
          segments[2] === 'evidence-documents' &&
          segments[4] === 'content')),
    methods: ['GET'],
  },
];

export type AtlasBackendAccess = 'allowed' | 'not-found' | 'method-not-allowed';

/** ¿Se puede reenviar este método a esta ruta de AtlasBackend? */
export function atlasBackendAccess(
  method: string,
  segments: readonly string[],
): AtlasBackendAccess {
  const route = ALLOWED.find((candidate) => candidate.matches(segments));
  if (!route) return 'not-found';
  const verb = method.toUpperCase();
  // HEAD es un GET sin cuerpo: si se admite leer, se admite preguntar por las cabeceras.
  const effective = verb === 'HEAD' ? 'GET' : verb;
  return (route.methods as readonly string[]).includes(effective)
    ? 'allowed'
    : 'method-not-allowed';
}
