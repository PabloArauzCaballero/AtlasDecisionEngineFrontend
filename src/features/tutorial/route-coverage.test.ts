import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TUTORIALS, tutorialsForRoute } from './interactive-catalog';
import { TUTORIAL_META_LIST } from './tutorial-registry.data';

/**
 * Un recorrido escrito que nadie encuentra es un recorrido que no existe.
 *
 * El Centro de Tutoriales lo lista todo, pero la ayuda que la gente usa de verdad es el
 * botón junto al título de la pantalla, y ese botón depende de que la ruta esté cableada
 * en `interactive-catalog`. Esa tabla y el registro se editan por separado, así que se
 * desincronizan en silencio: `coverage` estuvo publicado apuntando a `/coverage`, una ruta
 * que no existe en el portal, y por eso nunca llegó a ofrecerse en su propia pantalla.
 * Nadie lo notó porque en el Centro se veía perfectamente.
 */

/** Rutas de `(portal)` tal como las ve el router, con los segmentos dinámicos intactos. */
function portalRoutes(directory: string, prefix = '', found: string[] = []): string[] {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      portalRoutes(path, `${prefix}/${entry}`, found);
    } else if (entry === 'page.next.tsx') {
      found.push(prefix || '/');
    }
  }
  return found;
}

const ROUTES = portalRoutes(join(process.cwd(), 'src/app/(portal)'));

/** Un segmento dinámico real, para poder preguntar por la ruta de una ficha. */
const sample = (route: string) => route.replace(/\[[^\]]+\]/g, 'demo-id');

describe('cableado de los recorridos a sus pantallas', () => {
  it('toda ficha con ruta se ofrece en alguna pantalla del portal', () => {
    // Se pregunta por CUALQUIER ruta y no por la suya: los recorridos de ficha declaran a
    // propósito la ruta del listado —de ahí salen el permiso y el destino de «Comenzar»—
    // y se ofrecen en la ruta de detalle. Lo que no puede pasar es que no se ofrezcan en
    // ninguna, que es el caso que se coló con `/coverage`.
    const offered = new Set(ROUTES.flatMap((route) => tutorialsForRoute(sample(route))));
    const unreachable = TUTORIAL_META_LIST.filter((meta) => meta.route)
      .filter((meta) => !offered.has(meta.id))
      .map((meta) => `${meta.id} → ${meta.route}`);

    expect(
      unreachable,
      `Recorridos que sólo aparecen en el Centro, nunca en su pantalla:\n${unreachable.join('\n')}`,
    ).toEqual([]);
  });

  it('ninguna ficha apunta a una ruta que el portal no tiene', () => {
    const patterns = ROUTES.map((route) => new RegExp(`^${sample(route)}$`));
    const dangling = TUTORIAL_META_LIST.filter((meta) => meta.route)
      .filter((meta) => !patterns.some((pattern) => pattern.test(meta.route as string)))
      .map((meta) => `${meta.id} → ${meta.route}`);

    expect(dangling, `Fichas con ruta inexistente:\n${dangling.join('\n')}`).toEqual([]);
  });

  it('toda ruta cableada tiene su definición de pasos cargada', () => {
    const missing = ROUTES.flatMap((route) => tutorialsForRoute(sample(route)))
      .filter((id) => !(id in TUTORIALS))
      .map((id) => id);

    expect(missing, `Rutas que ofrecen un tutorial sin pasos:\n${missing.join('\n')}`).toEqual([]);
  });

  it('las capacidades §5–§10 ya no se entregan sin recorrido', () => {
    // Campos calculados, librerías, QA Lab, workers y matriz de cobertura llegaron sin
    // ninguna ayuda guiada, y son justo las pantallas que menos se adivinan mirándolas.
    for (const route of [
      '/calculated-fields',
      '/libraries',
      '/qa-lab',
      '/workers',
      '/coverage-matrix',
    ]) {
      expect(tutorialsForRoute(route), route).not.toEqual([]);
    }
  });

  it('la sección «Auditoría» entera tiene recorrido', () => {
    // Las seis pantallas del menú de Auditoría se entregaron sin ayuda guiada, y son las
    // que usa gente que no diseñó el sistema: un auditor externo, cumplimiento, el canal
    // de atención al titular. `/executions` era el caso engañoso — tenía recorrido de
    // FICHA (`execution-detail`), así que en el Centro parecía cubierto, pero quien
    // abría el listado no encontraba nada.
    for (const route of [
      '/executions',
      '/audit-events',
      '/model-monitoring',
      '/decision-quality',
      '/risk-governance',
      '/data-subject-requests',
    ]) {
      expect(tutorialsForRoute(route), route).not.toEqual([]);
    }
  });
});
