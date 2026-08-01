import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TUTORIALS } from './interactive-catalog';
import type { InteractiveStep } from './interactive-types';

/**
 * Auditoría del catálogo de tutoriales.
 *
 * Un tutorial se "buguea" casi siempre por la misma causa: apunta a un elemento
 * que ya no existe —se renombró un `data-tutorial-id`, se rehízo una pantalla—
 * y el recorrido se queda sin resaltar nada o, peor, esperando una acción sobre
 * algo que no está. Estas pruebas leen el código fuente y fallan en cuanto un
 * paso apunta a la nada, mucho antes de que lo descubra una persona a mitad de
 * un recorrido.
 */

function sourceFiles(directory: string, found: string[] = []): string[] {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) sourceFiles(path, found);
    else if (/\.tsx?$/.test(entry) && !/\.test\./.test(entry)) found.push(path);
  }
  return found;
}

const SOURCE = sourceFiles(join(process.cwd(), 'src'))
  .map((path) => readFileSync(path, 'utf8'))
  .join('\n');

const allSteps: Array<{ tutorial: string; step: InteractiveStep }> = Object.values(TUTORIALS)
  .flatMap((tutorial) => tutorial.steps.map((step) => ({ tutorial: tutorial.id, step })))
  .filter((entry) => Boolean(entry.step.target));

/** `[data-tutorial-id="graph-connect"]` → `graph-connect`. */
function tutorialId(selector: string): string | null {
  return /\[data-tutorial-id="([^"]+)"\]/.exec(selector)?.[1] ?? null;
}

describe('objetivos de los pasos', () => {
  it('todos los pasos apuntan a un elemento que existe en el código', () => {
    const missing = allSteps
      .filter(({ step }) => {
        const id = tutorialId(step.target as string);
        // Sólo se auditan los `data-tutorial-id`: un selector CSS libre puede
        // depender del estado y no se puede comprobar leyendo el código.
        return id !== null && !SOURCE.includes(`data-tutorial-id="${id}"`);
      })
      .map(({ tutorial, step }) => `${tutorial}/${step.id} → ${step.target}`);

    expect(missing, `Pasos que apuntan a un elemento inexistente:\n${missing.join('\n')}`).toEqual(
      [],
    );
  });

  it('ningún paso espera una acción sobre un elemento que puede no estar', () => {
    // Un paso que exige una acción y cuyo elemento puede faltar dejaría el
    // recorrido esperando para siempre. Si el elemento es condicional, el paso
    // debe ir marcado como opcional para que el recorrido lo salte.
    const risky = allSteps
      .filter(({ step }) => step.requiredAction && !step.optional)
      .filter(({ step }) => {
        const id = tutorialId(step.target as string);
        return id === null || !SOURCE.includes(`data-tutorial-id="${id}"`);
      })
      .map(({ tutorial, step }) => `${tutorial}/${step.id}`);

    expect(risky, `Pasos que podrían bloquear el recorrido:\n${risky.join('\n')}`).toEqual([]);
  });
});

describe('calidad del texto', () => {
  it('cada tutorial se presenta con un título y una frase de para qué sirve', () => {
    for (const tutorial of Object.values(TUTORIALS)) {
      expect(tutorial.title.length, tutorial.id).toBeGreaterThan(3);
      expect(tutorial.intro.length, tutorial.id).toBeGreaterThan(20);
      expect(tutorial.steps.length, tutorial.id).toBeGreaterThan(0);
    }
  });

  it('cada paso explica algo, no sólo nombra el botón', () => {
    for (const tutorial of Object.values(TUTORIALS)) {
      for (const step of tutorial.steps) {
        expect(step.title.length, `${tutorial.id}/${step.id}`).toBeGreaterThan(3);
        // El contenido debe ser una explicación, no una etiqueta: por debajo de
        // 40 caracteres casi siempre es "Pulsa aquí".
        expect(step.content.length, `${tutorial.id}/${step.id}`).toBeGreaterThan(40);
      }
    }
  });

  it('trata al usuario de la misma forma en todo el recorrido', () => {
    // El catálogo mezclaba voseo ("Hacé clic", "Elegí") con el tuteo del resto
    // del portal ("Pulsa", "Elige"). Cambiar de registro a mitad de un tutorial
    // hace que se lea como escrito por dos personas distintas y despista.
    const VOSEO =
      /\b(Hacé|Abrí|Elegí|Mirá|Poné|Andá|Pulsá|Escribí|Guardá|Probá|Revisá|Cargá|Seleccioná|Completá|Respetá|Dejá|Volvé|Cerrá|Usá|aprendés|podés|querés|tenés)\b/;
    const offenders: string[] = [];
    for (const tutorial of Object.values(TUTORIALS)) {
      for (const step of tutorial.steps) {
        const text = `${step.title} ${step.content} ${step.tip ?? ''}`;
        if (VOSEO.test(text)) offenders.push(`${tutorial.id}/${step.id}`);
      }
    }

    expect(offenders, `Pasos con registro mezclado:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('no repite identificadores de paso dentro de un mismo tutorial', () => {
    for (const tutorial of Object.values(TUTORIALS)) {
      const ids = tutorial.steps.map((step) => step.id);
      expect(new Set(ids).size, tutorial.id).toBe(ids.length);
    }
  });
});
