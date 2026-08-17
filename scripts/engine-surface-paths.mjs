/**
 * Qué rutas del motor llama de verdad el portal.
 *
 * Vive aparte de `engine-surface.mjs` porque son dos trabajos distintos: aquí se
 * LEE el código del portal para saber a qué endpoints habla; allí se compara ese
 * conjunto contra el inventario del motor y se decide si el gate pasa. Partirlo
 * también deja cada archivo por debajo del tope de 299 líneas del repositorio.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Rutas que el portal arma pasando VARIOS segmentos en una sola variable.
 *
 * `auth.api.ts` llama `sessionPath('login/pin')`, así que del código sale
 * `/v1/session/{p}` y del OpenAPI `/v1/session/login/pin`: dos segmentos contra
 * uno, y la comparación por segmentos —que resuelve todos los demás casos— no
 * puede casarlos. Antes que dar por exenta una operación que SÍ se consume
 * (una lista de deuda con mentiras dentro deja de leerse), se declara aquí la
 * enumeración concreta.
 */
const EXPANSIONS = [{ prefix: '/v1/session/', values: ['login/pin'] }];

/**
 * Los DOS prefijos con los que el motor publica superficie.
 *
 * `/pdf/*` faltaba, y su ausencia no se veía: el generador documental tiene sus
 * operaciones en el mismo OpenAPI, así que el inventario las lista, pero el
 * extractor sólo miraba `/v1/`. El resultado es el peor de los dos mundos —
 * `GET /pdf/artifacts` se llama desde `documents.api.ts` y el gate exigía una
 * exención por él—, y una lista de deuda con entradas falsas dentro deja de
 * leerse, que es exactamente lo que este gate existe para impedir.
 */
const ENGINE_PATH = /(?:\/v1|\/pdf)\/[A-Za-z0-9_\-./{}]*/g;

/**
 * Deja una ruta en la forma canónica con la que se comparan las dos orillas:
 * el `/v1/artifacts/{artifactId}` del OpenAPI y el `/v1/artifacts/${id}` del
 * portal son la misma superficie y tienen que colisionar.
 */
export function normalizePath(path) {
  return (
    path
      .replace(/\{[^}]*\}/g, '{p}')
      /*
       * Una interpolación PEGADA a un segmento no es un parámetro de ruta: es lo que queda de
       * `` `/v1/model-monitoring/coverage${query}` ``, donde `query` es la cadena de consulta.
       * Sin este corte, esa llamada producía `/v1/model-monitoring/coverage{p}`, no casaba con
       * nada, y el gate reclamaba una exención por un endpoint que la pantalla SÍ usa — que es
       * la clase de ruido que vuelve inútil una lista de deuda.
       *
       * Se trunca desde ahí en vez de tragarse el resto: lo que sigue a una interpolación
       * desconocida no se puede afirmar, y este gate prefiere quedarse corto (pide una exención
       * de más) antes que dar por vista una superficie que nadie mira.
       */
      .replace(/(?<!\/)\{p\}.*$/, '')
      .replace(/\/+$/, '')
      .replace(/\/{2,}/g, '/')
  );
}

/**
 * Rutas que el portal llama, agrupadas por número de segmentos.
 *
 * Las interpolaciones se colapsan ANTES de extraer: `${encodeURIComponent(id)}`
 * lleva paréntesis dentro y cualquier clase de caracteres razonable lo partiría
 * por la mitad, dejando la ruta a medias y contándola como no consumida.
 */
export function consumedPaths(root) {
  const consumed = new Set();
  for (const file of sourceTree(join(root, 'src'))) {
    const name = relative(root, file).replaceAll('\\', '/');
    // Una prueba que simula un endpoint no lo hace visible a nadie.
    if (/\.test\.tsx?$/.test(name)) continue;
    const collapsed = inlineHelpers(readFileSync(file, 'utf8')).replaceAll(/\$\{[^}]*\}/g, '{p}');
    for (const match of collapsed.matchAll(ENGINE_PATH)) {
      for (const path of expand(normalizePath(match[0]))) consumed.add(path);
    }
  }
  return indexByLength(consumed);
}

/**
 * ¿Alguna llamada del portal cubre esta operación?
 *
 * Coincidencia exacta, y si no, por segmentos con el comodín del lado del
 * PORTAL: un `{p}` suyo casa con cualquier segmento del motor. Es lo que hace
 * que `/v1/workers/{p}/runs/{p}` cubra los cuatro workers y que
 * `/v1/code-imports/{p}/{p}` cubra `cancel`, `confirm` y `save-draft` — el
 * portal recorre esas variantes con una variable y el OpenAPI las publica una a
 * una.
 *
 * El comodín NO se estira a varios segmentos. Con `{p}` tragando lo que fuera,
 * el `/v1/artifacts/{p}` que ya se consume habría dado por vista toda la rama de
 * artefactos, y este gate existe precisamente para que una rama nueva no pase
 * inadvertida.
 */
export function isConsumed(operationPath, consumedByLength) {
  const segments = operationPath.split('/');
  const candidates = consumedByLength.get(segments.length) ?? [];
  return candidates.some((candidate) =>
    candidate.split('/').every((part, index) => part === '{p}' || part === segments[index]),
  );
}

/**
 * Sustituye la indirección de un solo salto antes de leer las rutas.
 *
 * El portal casi nunca escribe la ruta entera en el sitio de la llamada: hay un
 * `const RUTA = '/v1/workers/semantic-analysis/unresolved'` y luego
 * `` `${RUTA}/${id}/resolve` ``, o un `function base(v)` que devuelve la ruta y
 * se llama como `` `${base(v)}/${refId}` ``. Sin deshacer eso, la ruta que se
 * extrae empieza por `{p}` y no por `/v1`, y el endpoint queda contado como no
 * consumido. Es la diferencia entre una lista de deuda de 46 líneas y una de 34,
 * y doce exenciones falsas bastan para que nadie se crea las otras.
 */
function inlineHelpers(source) {
  const declarations = [
    // const RUTA = '/v1/…'  |  const base = (id) => `/v1/…`
    /const\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:\([^)]*\)\s*(?::[^=]+)?=>\s*)?[`'"](\/v1\/[^`'"]*)[`'"]/g,
    // function base(id): string { return `/v1/…` }
    /function\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)[^{]*\{\s*return\s*[`'"](\/v1\/[^`'"]*)[`'"]/g,
  ];
  let text = source;
  for (const pattern of declarations) {
    for (const [, name, literal] of source.matchAll(pattern)) {
      text = text.replaceAll(`\${${name}}`, literal);
      // `${base(versionId)}` — la llamada, no la referencia.
      text = text.replaceAll(new RegExp(`\\$\\{${name}\\([^)]*\\)\\}`, 'g'), literal);
    }
  }
  return text;
}

/** La ruta tal cual, más sus variantes con la enumeración ya sustituida. */
function expand(path) {
  const variants = [path];
  for (const { prefix, values } of EXPANSIONS) {
    if (!path.startsWith(`${prefix}{p}`)) continue;
    const rest = path.slice(`${prefix}{p}`.length);
    for (const value of values) variants.push(normalizePath(`${prefix}${value}${rest}`));
  }
  return variants;
}

/** Agrupadas por número de segmentos, que es lo único que la comparación mira. */
function indexByLength(consumed) {
  const index = new Map();
  for (const path of consumed) {
    const length = path.split('/').length;
    if (!index.has(length)) index.set(length, []);
    index.get(length).push(path);
  }
  return index;
}

/** Todos los `.ts`/`.tsx` bajo un directorio. */
function sourceTree(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...sourceTree(full));
    else if (/\.tsx?$/.test(entry.name)) files.push(full);
  }
  return files;
}
