import { clearSessionData, SIMULATOR_PREFILL_KEY, SQL_CONSOLE_TABS_KEY } from './session-data';

/**
 * Estación compartida por turnos: el SQL de la consola y la copia del expediente que va al
 * simulador no pueden quedarse para la siguiente persona.
 */
describe('clearSessionData', () => {
  it('borra el SQL guardado y la copia al simulador, y deja las preferencias', () => {
    window.localStorage.setItem(SQL_CONSOLE_TABS_KEY, '[{"statement":"WHERE ci = \'4455667\'"}]');
    window.localStorage.setItem('atlas.theme', 'dark');
    window.sessionStorage.setItem(SIMULATOR_PREFILL_KEY, '{"variables":{"ci":"4455667"}}');

    clearSessionData();

    expect(window.localStorage.getItem(SQL_CONSOLE_TABS_KEY)).toBeNull();
    expect(window.sessionStorage.getItem(SIMULATOR_PREFILL_KEY)).toBeNull();
    expect(window.localStorage.getItem('atlas.theme')).toBe('dark');
  });
});
