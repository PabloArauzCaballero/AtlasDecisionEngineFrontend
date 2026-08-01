import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Contraste de los tokens de color, medido — no revisado a ojo.
 *
 * Un portal de gobierno de decisiones lo usan turnos enteros de analistas, y el
 * texto tenue es donde primero se pierde legibilidad. Esta prueba fija el suelo
 * de WCAG AA para que nadie pueda aclarar un gris "porque queda mejor" sin que
 * el gate lo cante.
 */
const css = readFileSync(join(process.cwd(), 'src/styles/parts/theme.css'), 'utf8');

function palette(from: string, to?: string): Record<string, string> {
  const start = css.indexOf(from);
  const end = to ? css.indexOf(to) : css.length;
  const block = css.slice(start, end);
  return Object.fromEntries(
    [...block.matchAll(/(--[a-z-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)].map((m) => [m[1]!, m[2]!]),
  );
}

function relativeLuminance(hex: string): number {
  let value = hex.slice(1);
  if (value.length === 3) value = [...value].map((c) => c + c).join('');
  const channels = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255);
  const linear = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
}

function contrast(foreground: string, background: string): number {
  const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)].sort(
    (a, b) => b - a,
  );
  return (lighter! + 0.05) / (darker! + 0.05);
}

const LIGHT = palette(':root,', ":root[data-theme='dark']");
const DARK = palette(":root[data-theme='dark']", '.theme-switching');

/** Todo lo que puede quedar debajo de un texto. */
const SURFACES = [
  '--canvas',
  '--surface',
  '--surface-sunken',
  '--surface-raised',
  '--surface-hover',
  '--surface-inset',
];
/** Todo lo que se dibuja como texto encima. */
const INKS = [
  '--ink',
  '--ink-strong',
  '--text',
  '--muted',
  '--faint',
  '--accent',
  '--accent-strong',
  '--danger',
  '--warning',
  '--success',
  '--info',
];

describe.each([
  ['claro', LIGHT],
  ['oscuro', DARK],
])('contraste del tema %s', (_name, theme) => {
  it('define todos los tokens de texto y superficie', () => {
    for (const token of [...INKS, ...SURFACES]) expect(theme[token]).toBeDefined();
  });

  it.each(INKS)('%s alcanza AA (4.5:1) sobre cualquier superficie', (ink) => {
    for (const surface of SURFACES) {
      const ratio = contrast(theme[ink]!, theme[surface]!);
      expect(
        ratio,
        `${ink} sobre ${surface} da ${ratio.toFixed(2)}:1, por debajo de 4.5:1`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each([
    ['--danger', '--danger-wash'],
    ['--warning', '--warning-wash'],
    ['--success', '--success-wash'],
    ['--info', '--info-wash'],
    ['--accent', '--accent-wash'],
    // Las variantes profundas existen precisamente para este par.
    ['--danger-strong', '--danger-wash'],
    ['--warning-strong', '--warning-wash'],
    ['--success-strong', '--success-wash'],
    ['--info-strong', '--info-wash'],
    ['--highlight', '--highlight-wash'],
  ])('%s se lee sobre su propio fondo tenue (%s)', (ink, wash) => {
    expect(contrast(theme[ink]!, theme[wash]!)).toBeGreaterThanOrEqual(4.5);
  });

  it('el texto de código se lee sobre la superficie de código', () => {
    // Esta pareja no depende del tema: es oscura en los dos, y por eso se
    // comprueba aparte de las superficies normales.
    expect(contrast(theme['--code-ink']!, theme['--code-surface']!)).toBeGreaterThanOrEqual(4.5);
  });
});
