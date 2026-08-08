import { type Locator, type Page } from '@playwright/test';
import { AUDIT_ROUTES } from './responsive-matrix';

/**
 * Acciones que NO se pulsan en un barrido contra el motor real.
 *
 * Un barrido que pulsa todo sobre datos reales borra artefactos, aprueba
 * versiones y despliega a producción. Se clasifica por el nombre accesible del
 * botón, que es el mismo texto que lee una persona, y **lo omitido se informa**:
 * un tope silencioso se leería como «se probó todo» cuando no fue así.
 */
const DESTRUCTIVAS =
  /elimin|borrar|archivar|desactivar|revocar|aprobar|rechazar|promover|desplegar|publicar|ejecutar ahora|cancelar ejecución|reintentar|purgar|cerrar caso|resolver|descartar|salir|cerrar sesión/i;

/** Abre algo modal, y por tanto hay que cerrarlo antes de seguir. */
const ABRE_DIALOGO =
  /nuev|crear|añadir|agregar|editar|importar|configurar|filtr|exportar|descargar/i;

export function esDestructiva(nombre: string): boolean {
  return DESTRUCTIVAS.test(nombre);
}

export function abreDialogo(nombre: string): boolean {
  return ABRE_DIALOGO.test(nombre);
}

/**
 * Nombre accesible de un control, o `''` si no tiene ninguno.
 *
 * Un botón sin nombre accesible es un defecto real, no una curiosidad: un lector
 * de pantalla lo anuncia como «botón» y nada más, y quien navega con teclado no
 * puede saber qué hace. Por eso se devuelve vacío en vez de inventar un texto.
 */
export async function nombreDe(control: Locator): Promise<string> {
  const [aria, texto, titulo] = await Promise.all([
    control.getAttribute('aria-label'),
    control.innerText().catch(() => ''),
    control.getAttribute('title'),
  ]);
  return (aria ?? '').trim() || (texto ?? '').trim() || (titulo ?? '').trim();
}

/**
 * En qué estado quedó la vista tras navegar.
 *
 * Tres desenlaces distintos que hay que poder distinguir, porque exigen
 * respuestas distintas: seguir, volver a entrar, o anotar el fallo.
 */
export type EstadoVista = 'lista' | 'sesion-perdida' | 'no-asentada';

/**
 * Espera a que la vista esté REALMENTE pintada, y dice en qué estado quedó.
 *
 * Historia de tres intentos, porque cada uno enseña algo:
 *
 *  1º · `waitFor detached` sobre el indicador de carga, con `.catch()`. El
 *       `catch` toleraba las vistas sin esqueleto y de paso se tragaba el caso
 *       contrario —seguía cargando al agotarse el plazo—, así que la captura
 *       salía del spinner en silencio.
 *  2º · Lo mismo sin tragarse el timeout. Seguía fallando: `PortalSessionGuard`
 *       monta su pantalla DESPUÉS del primer render, de modo que al comprobar
 *       aún no existía, `detached` se cumplía al momento y el spinner aparecía
 *       justo después. Una espera por ausencia siempre corre esa carrera.
 *  3º · Señal positiva… aceptando también la pantalla de acceso. Peor todavía:
 *       cuando la sesión se perdía a mitad de la corrida, el portal redirigía a
 *       `/login` y la evidencia daba por buena una captura del formulario de
 *       acceso rotulada como si fuera la vista. Pesaba lo que pesa una pantalla
 *       llena, así que ninguna comprobación de tamaño la atrapaba.
 *
 * De ahí la forma actual: se espera el MARCO DEL PORTAL, y la pantalla de acceso
 * no es un éxito sino un diagnóstico —`sesion-perdida`— que quien llama tiene que
 * resolver volviendo a entrar.
 */
export async function esperarVista(page: Page, plazoMs = 45_000): Promise<EstadoVista> {
  const marco = page.locator('.sidebar').first();
  const acceso = page.locator('.login-page').first();

  try {
    await Promise.race([
      marco.waitFor({ state: 'visible', timeout: plazoMs }),
      acceso.waitFor({ state: 'visible', timeout: plazoMs }),
    ]);
  } catch {
    return 'no-asentada';
  }

  // La sesión se cayó y el guard redirigió: lo que hay en pantalla no es la
  // vista que se pidió, por muy bien pintado que esté.
  if (await acceso.isVisible().catch(() => false)) return 'sesion-perdida';

  /*
   * Ya montada, que sus datos hayan llegado. Aquí sí vale esperar por ausencia:
   * el esqueleto de una tabla se monta CON la vista, no después de ella.
   */
  const cargando = page.locator('main.loading-screen, .skeleton, [aria-busy="true"]');
  try {
    await cargando.first().waitFor({ state: 'detached', timeout: plazoMs });
  } catch {
    if ((await cargando.count()) > 0) return 'no-asentada';
  }

  await page.waitForTimeout(250);
  return 'lista';
}

/**
 * Rutas con parámetro, resueltas contra los datos que HAY.
 *
 * `AUDIT_ROUTES` fija `/1` en cada ruta de detalle porque el motor simulado
 * sirve ese identificador siempre. Contra la base real casi ninguno existe, y el
 * barrido medía catorce pantallas de «no encontrado» creyendo que medía catorce
 * vistas de detalle: en verde, y sin haber probado nada.
 *
 * Aquí el identificador se descubre navegando, igual que lo haría una persona:
 * se abre el listado y se toma el primer enlace que apunta al detalle. Lo que no
 * tenga datos se informa y se excluye, en vez de convertirse en un 404 que
 * ensucia el barrido o —peor— en una vista vacía que pasa por buena.
 */
export interface RutaParametrizada {
  /** Ruta de detalle tal como aparece en la matriz, con su `/1`. */
  readonly plantilla: string;
  /** Listado desde el que se descubre un identificador real. */
  readonly listado: string;
  /** Prefijo de los enlaces de detalle dentro de ese listado. */
  readonly prefijo: string;
}

export const RUTAS_PARAMETRIZADAS: readonly RutaParametrizada[] = [
  { plantilla: '/variables/1', listado: '/variables', prefijo: '/variables/' },
  {
    plantilla: '/calculated-fields/1',
    listado: '/calculated-fields',
    prefijo: '/calculated-fields/',
  },
  { plantilla: '/artifacts/1', listado: '/artifacts', prefijo: '/artifacts/' },
  { plantilla: '/artifacts/1/dependency-graph', listado: '/artifacts', prefijo: '/artifacts/' },
  {
    plantilla: '/artifact-versions/1/graph',
    listado: '/artifacts',
    prefijo: '/artifact-versions/',
  },
  {
    plantilla: '/artifact-versions/1/compile',
    listado: '/artifacts',
    prefijo: '/artifact-versions/',
  },
  {
    plantilla: '/artifact-versions/1/test-suites',
    listado: '/artifacts',
    prefijo: '/artifact-versions/',
  },
  { plantilla: '/test-suites/1/cases', listado: '/test-suites', prefijo: '/test-suites/' },
  { plantilla: '/test-runs/1', listado: '/test-cases', prefijo: '/test-runs/' },
  { plantilla: '/test-runs/1/coverage', listado: '/test-cases', prefijo: '/test-runs/' },
  { plantilla: '/objectives/1', listado: '/objectives', prefijo: '/objectives/' },
  { plantilla: '/approval-requests/1', listado: '/reviews', prefijo: '/approval-requests/' },
  { plantilla: '/security-review/1', listado: '/reviews', prefijo: '/security-review/' },
  { plantilla: '/manual-reviews/1', listado: '/manual-reviews', prefijo: '/manual-reviews/' },
  { plantilla: '/executions/1', listado: '/executions', prefijo: '/executions/' },
];

export interface RutasResueltas {
  /** Rutas navegables: las fijas más las de detalle con identificador real. */
  readonly rutas: string[];
  /** Detalles sin datos en esta base. Se informan; no se dan por probados. */
  readonly sinDatos: string[];
}

/**
 * Sustituye cada `/1` por un identificador que existe, o descarta la ruta.
 *
 * El identificador se busca en el listado y no por API para no depender de la
 * forma de cada endpoint: si el listado enlaza al detalle, ese enlace es por
 * definición un identificador válido y alcanzable desde la interfaz.
 */
export async function resolverRutas(page: Page): Promise<RutasResueltas> {
  const rutas: string[] = [];
  const sinDatos: string[] = [];
  const cache = new Map<string, string | null>();

  for (const ruta of AUDIT_ROUTES) {
    if (ruta === '/login') continue;
    const parametrizada = RUTAS_PARAMETRIZADAS.find((p) => p.plantilla === ruta);
    if (parametrizada === undefined) {
      rutas.push(ruta);
      continue;
    }

    const clave = `${parametrizada.listado}|${parametrizada.prefijo}`;
    if (!cache.has(clave)) {
      cache.set(clave, await descubrirIdentificador(page, parametrizada));
    }
    const identificador = cache.get(clave) ?? null;
    if (identificador === null) {
      sinDatos.push(ruta);
      continue;
    }
    rutas.push(ruta.replace(/\/1(\/|$)/, `/${identificador}$1`));
  }

  return { rutas, sinDatos };
}

async function descubrirIdentificador(
  page: Page,
  { listado, prefijo }: RutaParametrizada,
): Promise<string | null> {
  await page.goto(listado, { waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => null);
  await esperarVista(page);

  const enlaces = page.locator(`a[href^="${prefijo}"]`);
  const total = await enlaces.count().catch(() => 0);
  for (let i = 0; i < total; i += 1) {
    const href = await enlaces.nth(i).getAttribute('href');
    // `/artifacts/` casa también con `/artifacts/nuevo`: el identificador tiene
    // que ser un número, que es lo que el motor emite.
    const encontrado = href?.slice(prefijo.length).split('/')[0] ?? '';
    if (/^\d+$/.test(encontrado)) return encontrado;
  }
  return null;
}
