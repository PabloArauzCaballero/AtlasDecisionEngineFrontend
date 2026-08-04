import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { breakpoints, tapMinimumPx, upTo } from './breakpoints';

const partsDir = join(process.cwd(), 'src/styles/parts');
const sheets = readdirSync(partsDir).filter((name) => name.endsWith('.css'));

/** Todos los anchos citados en un `@media` de cualquier hoja, con su origen. */
function widthQueries(): { sheet: string; px: number }[] {
  const found: { sheet: string; px: number }[] = [];
  for (const sheet of sheets) {
    const css = readFileSync(join(partsDir, sheet), 'utf8');
    for (const match of css.matchAll(/@media[^{]*?\((?:max|min)-width:\s*(\d+)px\)/g)) {
      found.push({ sheet, px: Number(match[1]) });
    }
  }
  return found;
}

/**
 * El punto de corte NO es una preferencia de quien escribe la hoja.
 *
 * Había nueve valores repartidos por catorce hojas, algunos separados por 40 px
 * —una diferencia que no distingue ningún dispositivo ni ninguna reorganización,
 * sólo distingue quién los escribió—. La consecuencia práctica: nadie podía
 * añadir una vista sin adivinar cuál le tocaba, y dos vistas hermanas se
 * reorganizaban a anchos distintos.
 *
 * CSS no admite `var()` dentro de `@media`, así que los números se escriben a
 * mano y ningún mecanismo del lenguaje los ata. Esta prueba es ese mecanismo.
 */
describe('escala de puntos de corte', () => {
  it('ninguna hoja usa un ancho fuera de la escala', () => {
    const permitidos = new Set<number>(Object.values(breakpoints));
    const intrusos = widthQueries().filter((query) => !permitidos.has(query.px));

    expect(
      intrusos.map((query) => `${query.sheet} usa ${query.px}px`),
      `Puntos de corte permitidos: ${[...permitidos].sort((a, b) => a - b).join(', ')}. ` +
        'Si una vista necesita otro, el sitio de decidirlo es breakpoints.ts, no la hoja.',
    ).toEqual([]);
  });

  it('la escala está ordenada y sin duplicados', () => {
    const valores = Object.values(breakpoints);
    expect([...valores].sort((a, b) => a - b)).toEqual([...valores]);
    expect(new Set(valores).size).toBe(valores.length);
  });

  it('expone las consultas listas para matchMedia', () => {
    expect(upTo('md')).toBe('(max-width: 820px)');
  });

  it('mantiene el mínimo táctil de AA en el token CSS', () => {
    const css = readFileSync(join(partsDir, 'responsive-tokens.css'), 'utf8');
    expect(css).toContain(`--tap-min: ${tapMinimumPx}px`);
  });
});
