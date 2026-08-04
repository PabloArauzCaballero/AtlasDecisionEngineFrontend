'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Tooltip } from '../components/Tooltip';
import {
  applyTheme,
  readThemePreference,
  resolveTheme,
  writeThemePreference,
  type ThemePreference,
} from './theme';

const ORDER: readonly ThemePreference[] = ['system', 'light', 'dark'];
const ICONS = { system: Monitor, light: Sun, dark: Moon };
const LABELS = {
  system: 'Tema del sistema',
  light: 'Tema claro',
  dark: 'Tema oscuro',
} as const;
const HINTS = {
  system: 'Sigue la preferencia de tu sistema operativo. Pulsa para fijar el tema claro.',
  light: 'Tema claro fijo. Pulsa para cambiar al tema oscuro.',
  dark: 'Tema oscuro fijo. Pulsa para volver a seguir al sistema.',
} as const;

/**
 * Conmutador de tema: sistema → claro → oscuro → sistema.
 *
 * Tres estados y no dos porque "seguir al sistema" es un estado propio: quien
 * lo elige quiere que la aplicación cambie sola al anochecer, y un interruptor
 * de dos posiciones no puede expresar eso.
 *
 * El botón arranca en `system` para coincidir con el HTML del servidor y lee la
 * preferencia real tras montar; el script de arranque ya pintó el tema correcto
 * antes, así que no hay destello ni discrepancia de hidratación.
 */
export function ThemeToggle() {
  const [preference, setPreference] = useState<ThemePreference>('system');
  // El botón se renderiza en el servidor con el valor provisional `system`. Sin
  // esta bandera, el efecto que aplica el tema correría una vez con ese valor
  // provisional y pisaría con el tema del sistema lo que ya había dejado puesto
  // el script de arranque.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setPreference(readThemePreference());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    // Red de seguridad: normalmente el script de arranque ya dejó el tema
    // puesto, pero si no llegó a ejecutarse, la preferencia guardada se aplica
    // igualmente al montar.
    applyTheme(resolveTheme(preference));
    // Con "seguir al sistema" activo, cambiar el tema del sistema operativo
    // debe repintar la aplicación al momento, sin recargar.
    if (preference !== 'system' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => applyTheme(resolveTheme('system'));
    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', sync);
      return () => query.removeEventListener('change', sync);
    }
    query.addListener(sync);
    return () => query.removeListener(sync);
  }, [preference, ready]);

  // El temporizador que retira la clase de transición se cancela al desmontar:
  // si el componente desaparece antes (una navegación, el cierre de sesión), el
  // callback tocaría un documento que ya no existe.
  const switching = useRef(0);
  useEffect(() => () => window.clearTimeout(switching.current), []);

  const cycle = () => {
    const next = ORDER[(ORDER.indexOf(preference) + 1) % ORDER.length];
    setPreference(next);
    writeThemePreference(next);
    // La transición de color se activa sólo durante el cambio: dejarla puesta
    // encarecería cada hover de la aplicación.
    document.documentElement.classList.add('theme-switching');
    applyTheme(resolveTheme(next));
    window.clearTimeout(switching.current);
    switching.current = window.setTimeout(
      () => document.documentElement.classList.remove('theme-switching'),
      260,
    );
  };

  const Icon = ICONS[preference];

  return (
    <Tooltip content={HINTS[preference]}>
      <button
        type="button"
        className="icon-button theme-toggle"
        data-tutorial-id="theme-toggle"
        onClick={cycle}
        aria-label={`${LABELS[preference]}. Cambiar tema`}
      >
        <Icon size={18} />
      </button>
    </Tooltip>
  );
}
