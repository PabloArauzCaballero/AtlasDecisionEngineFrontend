import { countMessages, formatRelative } from './assist-time';

const NOW = new Date('2026-09-29T12:00:00.000Z');

describe('formatRelative', () => {
  it.each([
    ['2026-09-29T11:59:40.000Z', 'ahora'],
    ['2026-09-29T11:55:00.000Z', 'hace 5 min'],
    ['2026-09-29T09:00:00.000Z', 'hace 3 h'],
    ['2026-09-28T09:00:00.000Z', 'ayer'],
    ['2026-09-25T12:00:00.000Z', 'hace 4 días'],
  ])('%s -> %s', (iso, expected) => {
    expect(formatRelative(iso, NOW)).toBe(expected);
  });

  it('pasada una semana da día y mes; una fecha rota da vacío', () => {
    expect(formatRelative('2026-09-01T12:00:00.000Z', NOW)).toMatch(/1.*sep/i);
    expect(formatRelative('no-es-fecha', NOW)).toBe('');
  });
});

describe('countMessages', () => {
  it('cada turno son dos mensajes', () => {
    expect(countMessages(1)).toBe('2 mensajes');
    expect(countMessages(0)).toBe('0 mensajes');
  });
});
