import {
  defaultOpen,
  explainerSection,
  readPreference,
  writePreference,
} from './explainer-preference';

const STORAGE_KEY = 'de.viewExplainer.open';

beforeEach(() => window.localStorage.clear());

describe('explainerSection', () => {
  it('agrupa las vistas de detalle con su sección', () => {
    expect(explainerSection('/artifacts')).toBe('artifacts');
    expect(explainerSection('/artifacts/55')).toBe('artifacts');
    expect(explainerSection('/')).toBe('');
  });
});

describe('defaultOpen', () => {
  it('el banner nace desplegado en las vistas de lectura', () => {
    expect(defaultOpen('/artifacts')).toBe(true);
    expect(defaultOpen('/test-cases')).toBe(true);
  });

  /*
   * El editor de grafo es una mesa de trabajo: el banner desplegado ocupa
   * ~290 px y empujaba el lienzo hasta y=530 en una ventana de 900.
   */
  it('nace plegado en el editor de grafo', () => {
    expect(defaultOpen('/graph-editor')).toBe(false);
  });
});

describe('preferencia por sección', () => {
  it('sin nada guardado no hay preferencia', () => {
    expect(readPreference('/artifacts')).toBeNull();
  });

  it('plegar en una sección NO afecta a las demás', () => {
    writePreference('/artifacts', false);
    expect(readPreference('/artifacts')).toBe(false);
    expect(readPreference('/variables')).toBeNull();
  });

  it('una vista de detalle comparte la preferencia de su sección', () => {
    writePreference('/artifacts/55', false);
    expect(readPreference('/artifacts')).toBe(false);
  });

  it('respeta el formato antiguo (un valor global) hasta que se toque una sección', () => {
    window.localStorage.setItem(STORAGE_KEY, '0');
    expect(readPreference('/artifacts')).toBe(false);
    expect(readPreference('/variables')).toBe(false);

    writePreference('/artifacts', true);
    expect(readPreference('/artifacts')).toBe(true);
  });

  it('un contenido corrupto no rompe la vista: se cae al valor por defecto', () => {
    window.localStorage.setItem(STORAGE_KEY, '{no es json');
    expect(readPreference('/artifacts')).toBeNull();
  });

  it('se puede volver a desplegar el banner del editor y queda recordado', () => {
    expect(defaultOpen('/graph-editor')).toBe(false);
    writePreference('/graph-editor', true);
    expect(readPreference('/graph-editor')).toBe(true);
  });
});
