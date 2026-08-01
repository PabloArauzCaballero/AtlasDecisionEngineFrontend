import { fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeToggle } from './ThemeToggle';
import {
  applyTheme,
  readThemePreference,
  resolveTheme,
  THEME_BOOTSTRAP_SCRIPT,
  THEME_STORAGE_KEY,
  writeThemePreference,
} from './theme';

function stubSystemDark(dark: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: query.includes('prefers-color-scheme: dark') ? dark : false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
    }),
  });
}

beforeEach(() => stubSystemDark(false));
afterEach(() => {
  Reflect.deleteProperty(window, 'matchMedia');
  delete document.documentElement.dataset.theme;
  vi.restoreAllMocks();
});

describe('preferencia de tema', () => {
  it('sigue al sistema mientras el usuario no elija otra cosa', () => {
    expect(readThemePreference()).toBe('system');
    stubSystemDark(true);
    expect(resolveTheme('system')).toBe('dark');
    stubSystemDark(false);
    expect(resolveTheme('system')).toBe('light');
  });

  it('respeta la elección explícita por encima del sistema', () => {
    stubSystemDark(true);
    writeThemePreference('light');

    expect(readThemePreference()).toBe('light');
    expect(resolveTheme('light')).toBe('light');
  });

  it('no se rompe si el almacenamiento está bloqueado', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });

    expect(readThemePreference()).toBe('system');
    expect(() => writeThemePreference('dark')).not.toThrow();
  });

  it('escribe siempre un tema concreto en la raíz, nunca "system"', () => {
    applyTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    applyTheme('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});

describe('script de arranque', () => {
  it('usa la misma clave de almacenamiento que el resto del módulo', () => {
    expect(THEME_BOOTSTRAP_SCRIPT).toContain(THEME_STORAGE_KEY);
  });

  it('resuelve el tema antes de pintar, sin lanzar si algo falla', () => {
    // Se ejecuta tal cual llega al navegador: si tuviera un fallo de sintaxis o
    // dejara escapar una excepción, la página entera se quedaría sin tema.
    delete document.documentElement.dataset.theme;
    stubSystemDark(true);
    new Function(THEME_BOOTSTRAP_SCRIPT)();
    expect(document.documentElement.dataset.theme).toBe('dark');

    stubSystemDark(false);
    new Function(THEME_BOOTSTRAP_SCRIPT)();
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});

describe('ThemeToggle', () => {
  it('recorre sistema → claro → oscuro → sistema', () => {
    render(<ThemeToggle />);

    const button = () => screen.getByRole('button');
    expect(button()).toHaveAccessibleName(/Tema del sistema/);

    fireEvent.click(button());
    expect(button()).toHaveAccessibleName(/Tema claro/);
    expect(document.documentElement.dataset.theme).toBe('light');

    fireEvent.click(button());
    expect(button()).toHaveAccessibleName(/Tema oscuro/);
    expect(document.documentElement.dataset.theme).toBe('dark');

    fireEvent.click(button());
    expect(button()).toHaveAccessibleName(/Tema del sistema/);
  });

  it('explica en el tooltip qué hará la próxima pulsación', () => {
    render(<ThemeToggle />);

    expect(screen.getByRole('tooltip')).toHaveTextContent(/Pulsa para fijar el tema claro/);
  });

  it('recuerda la elección para la próxima visita', () => {
    render(<ThemeToggle />);

    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByRole('button'));

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });
});

describe('hojas de estilo del tema', () => {
  const read = (file: string) =>
    readFileSync(join(process.cwd(), 'src/styles/parts', file), 'utf8');

  it('define el mismo juego de tokens en claro y en oscuro', () => {
    const css = read('theme.css');
    const light = css.slice(css.indexOf(':root,'), css.indexOf(":root[data-theme='dark']"));
    const dark = css.slice(css.indexOf(":root[data-theme='dark']"));
    const names = (block: string) => new Set(block.match(/--[a-z-]+(?=:)/g) ?? []);

    // Un token declarado sólo en claro dejaría ese color sin definir en oscuro.
    expect([...names(light)].filter((token) => !names(dark).has(token))).toEqual([]);
  });

  it('no altera el tema claro: las reglas oscuras van todas acotadas', () => {
    for (const file of [
      'theme-dark-base.css',
      'theme-dark-features.css',
      'theme-dark-surfaces.css',
    ]) {
      const selectors = read(file)
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split('}')
        .map((block) => block.split('{')[0].trim())
        .filter(Boolean);
      for (const selector of selectors) {
        expect(selector, `${file}: ${selector}`).toContain("[data-theme='dark']");
      }
    }
  });
});
