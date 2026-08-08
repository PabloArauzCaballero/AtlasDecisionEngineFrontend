import { describe, expect, it } from 'vitest';
import { requiredRolesForPath } from '../../auth/route-access';
import { TUTORIALS } from './interactive-catalog';
import { allListings, canSeeTutorial, listingsForRoles, TUTORIAL_META } from './tutorial-registry';

/**
 * Validación del catálogo del Centro.
 *
 * Un tutorial mal declarado no revienta: desaparece de la lista, o peor, se
 * ofrece a quien no puede abrirlo y lo deja en una pantalla prohibida. Estas
 * pruebas convierten cada uno de esos silencios en un fallo del gate.
 */

const metas = Object.values(TUTORIAL_META);

describe('integridad del catálogo', () => {
  it('no hay identificadores duplicados', () => {
    const ids = metas.map((meta) => meta.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('todo tutorial con pasos tiene ficha en el Centro', () => {
    // Sin ficha no se lista: se puede disparar por ruta o por error, pero es
    // invisible para quien lo busque a mano. Casi siempre es un olvido.
    const missing = Object.keys(TUTORIALS).filter((id) => !TUTORIAL_META[id]);
    expect(missing, `Tutoriales sin metadatos: ${missing.join(', ')}`).toEqual([]);
  });

  it('toda ficha del Centro apunta a un tutorial que existe', () => {
    const orphans = metas.filter((meta) => !TUTORIALS[meta.id]).map((meta) => meta.id);
    expect(orphans, `Fichas sin pasos: ${orphans.join(', ')}`).toEqual([]);
  });

  it('ningún tutorial está vacío', () => {
    for (const listing of allListings()) {
      expect(listing.stepCount, listing.id).toBeGreaterThan(0);
    }
  });

  it('la duración estimada es un número de minutos creíble', () => {
    for (const meta of metas) {
      expect(meta.estimatedMinutes, meta.id).toBeGreaterThan(0);
      expect(meta.estimatedMinutes, meta.id).toBeLessThanOrEqual(30);
    }
  });
});

describe('rutas declaradas', () => {
  it('toda ruta de tutorial existe en el control de acceso del portal', () => {
    // Una ruta sin regla se deniega por defecto: el tutorial llevaría al usuario
    // a una pantalla prohibida. Este es exactamente el fallo que tenía
    // `coverage`, que apuntaba a `/coverage` en vez de a `/graph-coverage`.
    const unknown = metas
      .filter((meta) => meta.route && requiredRolesForPath(meta.route) === null)
      .map((meta) => `${meta.id} → ${meta.route}`);

    expect(unknown, `Rutas inexistentes:\n${unknown.join('\n')}`).toEqual([]);
  });
});

describe('prerrequisitos', () => {
  it('todo prerrequisito apunta a un tutorial declarado', () => {
    const broken: string[] = [];
    for (const meta of metas) {
      for (const id of meta.prerequisites ?? []) {
        if (!TUTORIAL_META[id]) broken.push(`${meta.id} → ${id}`);
      }
    }
    expect(broken, `Prerrequisitos rotos:\n${broken.join('\n')}`).toEqual([]);
  });

  it('ningún tutorial se exige a sí mismo', () => {
    const selfish = metas
      .filter((meta) => (meta.prerequisites ?? []).includes(meta.id))
      .map((meta) => meta.id);
    expect(selfish).toEqual([]);
  });

  it('no hay dependencias circulares', () => {
    // Un ciclo dejaría a los dos tutoriales bloqueándose mutuamente para
    // siempre: ninguno se podría empezar "en orden".
    const visiting = new Set<string>();
    const done = new Set<string>();
    const cycles: string[] = [];

    const walk = (id: string, trail: string[]): void => {
      if (done.has(id)) return;
      if (visiting.has(id)) {
        cycles.push([...trail, id].join(' → '));
        return;
      }
      visiting.add(id);
      for (const next of TUTORIAL_META[id]?.prerequisites ?? []) walk(next, [...trail, id]);
      visiting.delete(id);
      done.add(id);
    };

    for (const meta of metas) walk(meta.id, []);
    expect(cycles, `Ciclos de prerrequisitos:\n${cycles.join('\n')}`).toEqual([]);
  });

  it('un prerrequisito nunca exige más permisos que el tutorial que lo pide', () => {
    // Si el previo fuera más restrictivo, quien puede hacer el tutorial vería un
    // requisito que su rol no alcanza: un bloqueo imposible de resolver.
    const impossible: string[] = [];
    for (const meta of metas) {
      if (!meta.route) continue;
      const roles = requiredRolesForPath(meta.route) ?? [];
      // Un rol capaz de abrir la ruta del tutorial debe poder ver los previos.
      for (const id of meta.prerequisites ?? []) {
        const prerequisite = TUTORIAL_META[id];
        if (!prerequisite) continue;
        const reachable =
          roles.length === 0 || roles.some((role) => canSeeTutorial(prerequisite, [role]));
        if (!reachable) impossible.push(`${meta.id} exige ${id}`);
      }
    }
    expect(impossible, `Prerrequisitos inalcanzables:\n${impossible.join('\n')}`).toEqual([]);
  });
});

describe('filtrado por rol', () => {
  it('un rol sin permisos sólo ve los tutoriales universales', () => {
    const visible = listingsForRoles([]);
    // Sin roles quedan los que no dependen de una pantalla: bienvenida, sesión,
    // el propio Centro y los recorridos de error.
    expect(visible.every((listing) => !listing.route || listing.route === '/tutorials')).toBe(true);
    expect(visible.length).toBeGreaterThan(0);
  });

  it('un tester ve el editor de grafo; el analista de riesgo y el auditor no', () => {
    const tester = listingsForRoles(['QA_ANALYST']).map((listing) => listing.id);
    const risk = listingsForRoles(['RISK_ANALYST']).map((listing) => listing.id);
    const auditor = listingsForRoles(['AUDITOR']).map((listing) => listing.id);

    // Enseñar a diseñar reglas sólo tiene sentido para quien puede diseñarlas.
    expect(tester).toContain('graph-editor');
    expect(risk).not.toContain('graph-editor');
    expect(auditor).not.toContain('graph-editor');
    // Cada uno conserva lo suyo: el riesgo, sus casos; el auditor, la traza.
    expect(risk).toContain('execution-detail');
    expect(auditor).toContain('execution-detail');
  });

  it('nadie recibe un tutorial de una pantalla que su rol no puede abrir', () => {
    const ROLES = ['RISK_ANALYST', 'QA_ANALYST', 'AUDITOR', 'COMPLIANCE', 'OPERATIONS'];
    for (const role of ROLES) {
      for (const listing of listingsForRoles([role])) {
        if (!listing.route) continue;
        const roles = requiredRolesForPath(listing.route);
        expect(roles, `${listing.id} apunta a una ruta desconocida`).not.toBeNull();
        const open = (roles ?? []).length === 0;
        expect(open || (roles ?? []).includes(role), `${role} no debería ver ${listing.id}`).toBe(
          true,
        );
      }
    }
  });
});
